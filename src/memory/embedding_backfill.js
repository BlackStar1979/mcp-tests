"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");
const {
  BGE_M3_DIMENSIONS,
  OVH_MODEL,
  createEmbeddingClient,
} = require("./embedding_client");
const {
  contentHash,
  loadCachedEmbeddings,
  storeCachedEmbedding,
} = require("./embedding_cache");

async function readActiveUniqueMemory(memoryPath) {
  let raw;
  try {
    raw = await fsp.readFile(memoryPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const unique = new Map();
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry?.is_archived || typeof entry?.content !== "string" || !entry.content.trim()) continue;
    unique.set(contentHash(entry.content), entry.content);
  }
  return [...unique.values()];
}

async function backfillMemoryEmbeddings({
  logDir,
  limit = 100,
  dryRun = false,
  embeddingClient = createEmbeddingClient(),
} = {}) {
  const resolvedLogDir = path.resolve(logDir || path.join(__dirname, "../../_logs"));
  const boundedLimit = Math.max(1, Math.min(1000, Number.parseInt(limit, 10) || 100));
  const texts = await readActiveUniqueMemory(path.join(resolvedLogDir, ".mcp-agent-memory.jsonl"));
  const cached = loadCachedEmbeddings({
    logDir: resolvedLogDir,
    texts,
    provider: "ovh",
    model: OVH_MODEL,
    dimensions: BGE_M3_DIMENSIONS,
  });
  const missing = texts.filter((text) => !cached.has(contentHash(text)));
  const report = {
    ok: true,
    status: dryRun ? "planned" : "complete",
    active_unique: texts.length,
    cached_before: texts.length - missing.length,
    missing_before: missing.length,
    limit: boundedLimit,
    attempted: 0,
    stored: 0,
    remaining: missing.length,
    failure_status: "",
    plaintext_exposed: false,
    vector_exposed: false,
  };
  if (dryRun || missing.length === 0) return report;

  for (const text of missing.slice(0, boundedLimit)) {
    report.attempted += 1;
    const generated = await embeddingClient.generate(text);
    if (generated.status !== "ok") {
      report.ok = false;
      report.status = "blocked";
      report.failure_status = generated.status;
      break;
    }
    storeCachedEmbedding({
      logDir: resolvedLogDir,
      text,
      provider: generated.provider,
      model: generated.model,
      dimensions: generated.dimensions,
      vector: generated.vector,
    });
    report.stored += 1;
  }
  report.remaining = missing.length - report.stored;
  if (report.ok && report.remaining > 0) report.status = "partial";
  return report;
}

module.exports = {
  backfillMemoryEmbeddings,
  readActiveUniqueMemory,
};
