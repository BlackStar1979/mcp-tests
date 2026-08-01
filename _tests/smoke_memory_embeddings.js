"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

const {
  BGE_M3_DIMENSIONS,
  createEmbeddingClient,
  cosineSimilarity,
} = require("../src/memory/embedding_client");
const { backfillMemoryEmbeddings } = require("../src/memory/embedding_backfill");

function vectorAt(index, value = 1) {
  const vector = Array(BGE_M3_DIMENSIONS).fill(0);
  vector[index] = value;
  return vector;
}

function vectorWithCosine(primaryIndex, secondaryIndex, cosine) {
  const vector = vectorAt(primaryIndex, cosine);
  vector[secondaryIndex] = Math.sqrt(1 - (cosine * cosine));
  return vector;
}

function responseFor(vector) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ data: [{ embedding: vector }] }),
  };
}

(async () => {
  const runtimeAuditScript = path.join(__dirname, "..", "scripts", "audit-memory-embedding-runtime.ps1");
  const runtimeAuditSource = fs.readFileSync(runtimeAuditScript, "utf8");
  assert.ok(runtimeAuditSource.includes("ReadAllowlisted"));
  assert.ok(runtimeAuditSource.includes("secret_values_exposed = $false"));
  assert.ok(runtimeAuditSource.includes("activation_ready"));
  const runtimePresenceAudit = fs.readFileSync(
    path.join(__dirname, "..", "_workflow", "operator_decisions", "mem_1_runtime_config_presence_audit.md"),
    "utf8",
  );
  assert.ok(runtimePresenceAudit.includes("Status: GREEN / LIVE CONFIGURATION ABSENT / ACTIVATION BLOCKED SAFELY"));
  assert.ok(runtimePresenceAudit.includes("`activation_ready = false`"));
  assert.ok(runtimePresenceAudit.includes("`secret_values_exposed = false`"));
  const activationPackage = fs.readFileSync(
    path.join(__dirname, "..", "_workflow", "operator_decisions", "mem_1_secret_file_activation_package.md"),
    "utf8",
  );
  assert.ok(activationPackage.includes("Status: GREEN / LIVE ACTIVATED / QUALITY VERIFIED / BACKFILL COMPLETE"));
  assert.ok(activationPackage.includes("server_start_id = 2026-08-01T18:52:13.024Z"));
  assert.ok(activationPackage.includes("`activation_ready = true`"));

  if (process.platform === "win32") {
    const smokeSecret = "smoke-secret-must-not-leak";
    const previousRuntimeAuditEnv = {
      provider: process.env.MCP_TEST_MEMORY_EMBEDDING_PROVIDER,
      egress: process.env.MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS,
      token: process.env.OVH_AI_ENDPOINTS_ACCESS_TOKEN,
      tokenFile: process.env.MCP_TEST_MEMORY_EMBEDDING_TOKEN_FILE,
      timeout: process.env.MCP_TEST_MEMORY_EMBEDDING_TIMEOUT_MS,
    };
    const auditTempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-memory-runtime-audit-"));
    try {
      const provisionScript = path.join(__dirname, "..", "scripts", "provision-memory-embedding-token.ps1");
      const auditTokenFile = path.join(auditTempRoot, "token.txt");
      const provision = cp.spawnSync(
        "pwsh",
        ["-NoLogo", "-NoProfile", "-File", provisionScript, "-Path", auditTokenFile, "-TokenFromStdin"],
        { encoding: "utf8", input: smokeSecret + "\n" },
      );
      assert.equal(provision.status, 0, provision.stderr);
      assert.equal(provision.stdout.includes(smokeSecret), false);
      assert.equal(provision.stderr.includes(smokeSecret), false);
      const provisionPayload = JSON.parse(provision.stdout);
      assert.equal(provisionPayload.ok, true);
      assert.equal(provisionPayload.acl_inheritance_disabled, true);
      assert.equal(provisionPayload.token_value_exposed, false);
      assert.equal(provisionPayload.token_path_exposed, false);
      assert.equal(fs.readFileSync(auditTokenFile, "utf8"), smokeSecret);
      process.env.MCP_TEST_MEMORY_EMBEDDING_PROVIDER = " OVH ";
      process.env.MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS = "1";
      delete process.env.OVH_AI_ENDPOINTS_ACCESS_TOKEN;
      process.env.MCP_TEST_MEMORY_EMBEDDING_TOKEN_FILE = auditTokenFile;
      process.env.MCP_TEST_MEMORY_EMBEDDING_TIMEOUT_MS = "5000";
      const audit = cp.spawnSync(
        "pwsh",
        [
          "-NoLogo",
          "-NoProfile",
          "-File",
          runtimeAuditScript,
          "-ProcessId",
          String(process.pid),
          "-CachePath",
          path.join(auditTempRoot, "missing.sqlite"),
          "-AllowNonServerProcess",
        ],
        { encoding: "utf8" },
      );
      assert.equal(audit.status, 0, audit.stderr);
      assert.equal(audit.stdout.includes(smokeSecret), false);
      assert.equal(audit.stderr.includes(smokeSecret), false);
      const payload = JSON.parse(audit.stdout);
      assert.equal(payload.ok, true);
      assert.equal(payload.target_verified, false);
      assert.equal(payload.activation_ready, true);
      assert.equal(payload.config.provider_present, true);
      assert.equal(payload.config.provider_supported, true);
      assert.equal(payload.config.external_egress_enabled, true);
      assert.equal(payload.config.token_file_configured, true);
      assert.equal(payload.config.token_file_ready, true);
      assert.equal(payload.config.legacy_token_present, false);
      assert.equal(payload.config.token_source_conflict, false);
      assert.equal(payload.config.token_present, true);
      assert.equal(payload.config.timeout_effective_valid, true);
      assert.equal(payload.cache.present, false);
      assert.equal(payload.secret_values_exposed, false);
    } finally {
      for (const [name, value] of Object.entries({
        MCP_TEST_MEMORY_EMBEDDING_PROVIDER: previousRuntimeAuditEnv.provider,
        MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS: previousRuntimeAuditEnv.egress,
        OVH_AI_ENDPOINTS_ACCESS_TOKEN: previousRuntimeAuditEnv.token,
        MCP_TEST_MEMORY_EMBEDDING_TOKEN_FILE: previousRuntimeAuditEnv.tokenFile,
        MCP_TEST_MEMORY_EMBEDDING_TIMEOUT_MS: previousRuntimeAuditEnv.timeout,
      })) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      fs.rmSync(auditTempRoot, { recursive: true, force: true });
    }
  }

  let disabledFetches = 0;
  const disabled = createEmbeddingClient({
    env: {},
    fetchImpl: async () => {
      disabledFetches += 1;
      throw new Error("disabled client must not fetch");
    },
  });
  assert.deepEqual(await disabled.generate("lead management"), {
    vector: null,
    status: "disabled",
    provider: "disabled",
    model: "",
    dimensions: 0,
  });
  assert.equal(disabledFetches, 0);

  const missingEgress = createEmbeddingClient({
    env: {
      MCP_TEST_MEMORY_EMBEDDING_PROVIDER: "ovh",
      OVH_AI_ENDPOINTS_ACCESS_TOKEN: "test-token",
    },
    fetchImpl: async () => {
      throw new Error("egress-disabled client must not fetch");
    },
  });
  assert.equal((await missingEgress.generate("lead management")).status, "external_egress_disabled");

  const leadVector = vectorAt(0);
  const enabled = createEmbeddingClient({
    env: {
      MCP_TEST_MEMORY_EMBEDDING_PROVIDER: "ovh",
      MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS: "1",
      OVH_AI_ENDPOINTS_ACCESS_TOKEN: "test-token",
    },
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/embeddings");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, "Bearer test-token");
      assert.equal(JSON.parse(options.body).model, "bge-m3");
      return responseFor(leadVector);
    },
  });
  const generated = await enabled.generate("zarządzanie leadami");
  assert.equal(generated.status, "ok");
  assert.equal(generated.provider, "ovh");
  assert.equal(generated.model, "bge-m3");
  assert.equal(generated.dimensions, BGE_M3_DIMENSIONS);
  assert.deepEqual(generated.vector, leadVector);
  assert.equal(cosineSimilarity(leadVector, leadVector), 1);
  assert.equal(cosineSimilarity(leadVector, vectorAt(1)), 0);

  const invalid = createEmbeddingClient({
    env: {
      MCP_TEST_MEMORY_EMBEDDING_PROVIDER: "ovh",
      MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS: "1",
      OVH_AI_ENDPOINTS_ACCESS_TOKEN: "test-token",
    },
    fetchImpl: async () => responseFor([1, 2, 3]),
  });
  assert.equal((await invalid.generate("invalid dimensions")).status, "invalid_dimensions");

  const tokenFileRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-memory-token-file-"));
  try {
    const tokenFile = path.join(tokenFileRoot, "token.txt");
    fs.writeFileSync(tokenFile, "file-token\n", "utf8");
    const fromFile = createEmbeddingClient({
      env: {
        MCP_TEST_MEMORY_EMBEDDING_PROVIDER: "ovh",
        MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS: "1",
        MCP_TEST_MEMORY_EMBEDDING_TOKEN_FILE: tokenFile,
      },
      fetchImpl: async (_url, options) => {
        assert.equal(options.headers.Authorization, "Bearer file-token");
        return responseFor(leadVector);
      },
    });
    assert.equal((await fromFile.generate("file token")).status, "ok");

    const conflict = createEmbeddingClient({
      env: {
        MCP_TEST_MEMORY_EMBEDDING_PROVIDER: "ovh",
        MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS: "1",
        MCP_TEST_MEMORY_EMBEDDING_TOKEN_FILE: tokenFile,
        OVH_AI_ENDPOINTS_ACCESS_TOKEN: "inline-token",
      },
      fetchImpl: async () => { throw new Error("conflicted token sources must not fetch"); },
    });
    assert.equal((await conflict.generate("conflict")).status, "token_source_conflict");

    const missingFile = createEmbeddingClient({
      env: {
        MCP_TEST_MEMORY_EMBEDDING_PROVIDER: "ovh",
        MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS: "1",
        MCP_TEST_MEMORY_EMBEDDING_TOKEN_FILE: path.join(tokenFileRoot, "missing.txt"),
      },
      fetchImpl: async () => { throw new Error("missing token file must not fetch"); },
    });
    assert.equal((await missingFile.generate("missing")).status, "token_file_unreadable");

    const oversizedFile = path.join(tokenFileRoot, "oversized.txt");
    fs.writeFileSync(oversizedFile, "x".repeat(16 * 1024 + 1), "utf8");
    const oversized = createEmbeddingClient({
      env: {
        MCP_TEST_MEMORY_EMBEDDING_PROVIDER: "ovh",
        MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS: "1",
        MCP_TEST_MEMORY_EMBEDDING_TOKEN_FILE: oversizedFile,
      },
      fetchImpl: async () => { throw new Error("oversized token file must not fetch"); },
    });
    assert.equal((await oversized.generate("oversized")).status, "token_file_invalid");
  } finally {
    fs.rmSync(tokenFileRoot, { recursive: true, force: true });
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-memory-embeddings-"));
  const previousEnv = {
    logDir: process.env.MCP_TEST_MEMORY_LOG_DIR,
    provider: process.env.MCP_TEST_MEMORY_EMBEDDING_PROVIDER,
    egress: process.env.MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS,
    token: process.env.OVH_AI_ENDPOINTS_ACCESS_TOKEN,
  };
  const previousFetch = globalThis.fetch;
  try {
    process.env.MCP_TEST_MEMORY_LOG_DIR = tempRoot;
    process.env.MCP_TEST_MEMORY_EMBEDDING_PROVIDER = "ovh";
    process.env.MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS = "1";
    process.env.OVH_AI_ENDPOINTS_ACCESS_TOKEN = "test-token";

    const filmVector = vectorAt(1);
    const multilingualQueryVector = vectorAt(2);
    const multilingualTargetVector = vectorWithCosine(2, 3, 0.64);
    const lexicalSubstringDistractorVector = vectorAt(4);
    globalThis.fetch = async (_url, options) => {
      const input = JSON.parse(options.body).input;
      const normalizedInput = input.toLowerCase();
      if (normalizedInput.includes("film")) return responseFor(filmVector);
      if (normalizedInput.includes("green bicycle")) return responseFor(multilingualQueryVector);
      if (normalizedInput.includes("zielony rower")) return responseFor(multilingualTargetVector);
      if (normalizedInput.includes("unrelated deployment artifact")) return responseFor(lexicalSubstringDistractorVector);
      return responseFor(leadVector);
    };

    delete require.cache[require.resolve("../src/memory/memory_store")];
    delete require.cache[require.resolve("../src/memory/embedding_client")];
    delete require.cache[require.resolve("../src/memory/embedding_cache")];
    const { saveMemory, searchMemory } = require("../src/memory/memory_store");

    await saveMemory({
      agent_name: "codex",
      content: "zarządzanie leadami sprzedażowymi",
      type: "conclusion",
      category: "sales",
    });
    await saveMemory({
      agent_name: "codex",
      content: "recenzja filmu science fiction",
      type: "fact",
      category: "cinema",
    });

    const search = await searchMemory({
      query: "lead management pipeline",
      agent_name: "codex",
      top_k: 5,
      min_score: 0.1,
    });
    assert.equal(search.total_searched, 2);
    assert.equal(search.results.length, 1);
    assert.match(search.results[0].content, /leadami/);
    assert.ok(search.results[0].score > 0.7);
    assert.equal("embedding_v1" in search.results[0], false);

    const multilingualTarget = await saveMemory({
      agent_name: "codex",
      content: "Zielony rower jest przechowywany w szklanej oranżerii obok fontanny.",
      type: "fact",
      category: "quality-probe",
    });
    await saveMemory({
      agent_name: "codex",
      content: "Somewhere this another note asks: where is the unrelated deployment artifact?",
      type: "fact",
      category: "quality-probe",
    });
    const multilingualSearch = await searchMemory({
      query: "Where is the green bicycle kept near the fountain?",
      agent_name: "codex",
      top_k: 5,
      min_score: 0.1,
    });
    assert.equal(multilingualSearch.results[0].id, multilingualTarget.id);
    assert.ok(multilingualSearch.results[0].score > 0.27);

    const memoryText = fs.readFileSync(path.join(tempRoot, ".mcp-agent-memory.jsonl"), "utf8");
    assert.equal(memoryText.includes("embedding_v1"), false);
    assert.equal(fs.existsSync(path.join(tempRoot, ".mcp-agent-embeddings.sqlite")), true);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [name, value] of Object.entries({
      MCP_TEST_MEMORY_LOG_DIR: previousEnv.logDir,
      MCP_TEST_MEMORY_EMBEDDING_PROVIDER: previousEnv.provider,
      MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS: previousEnv.egress,
      OVH_AI_ENDPOINTS_ACCESS_TOKEN: previousEnv.token,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  const backfillRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-memory-backfill-"));
  try {
    fs.writeFileSync(
      path.join(backfillRoot, ".mcp-agent-memory.jsonl"),
      [
        { id: "a", content: "first active memory", is_archived: false },
        { id: "b", content: "second active memory", is_archived: false },
        { id: "c", content: "archived memory", is_archived: true },
        { id: "d", content: "first active memory", is_archived: false },
      ].map((entry) => JSON.stringify(entry)).join("\n") + "\n",
      "utf8",
    );
    const embeddingClient = { generate: async () => ({
      status: "ok",
      provider: "ovh",
      model: "bge-m3",
      dimensions: BGE_M3_DIMENSIONS,
      vector: vectorAt(7),
    }) };
    const firstBackfill = await backfillMemoryEmbeddings({ logDir: backfillRoot, embeddingClient });
    assert.deepEqual(
      { active: firstBackfill.active_unique, attempted: firstBackfill.attempted, stored: firstBackfill.stored, remaining: firstBackfill.remaining },
      { active: 2, attempted: 2, stored: 2, remaining: 0 },
    );
    const secondBackfill = await backfillMemoryEmbeddings({ logDir: backfillRoot, embeddingClient });
    assert.deepEqual(
      { cached: secondBackfill.cached_before, attempted: secondBackfill.attempted, stored: secondBackfill.stored },
      { cached: 2, attempted: 0, stored: 0 },
    );
    assert.equal(firstBackfill.plaintext_exposed, false);
    assert.equal(firstBackfill.vector_exposed, false);
  } finally {
    fs.rmSync(backfillRoot, { recursive: true, force: true });
  }

  const cacheFailureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-memory-cache-failure-"));
  try {
    process.env.MCP_TEST_MEMORY_LOG_DIR = cacheFailureRoot;
    process.env.MCP_TEST_MEMORY_EMBEDDING_PROVIDER = "ovh";
    process.env.MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS = "1";
    process.env.OVH_AI_ENDPOINTS_ACCESS_TOKEN = "test-token";
    fs.mkdirSync(path.join(cacheFailureRoot, ".mcp-agent-embeddings.sqlite"));
    globalThis.fetch = async () => responseFor(leadVector);

    delete require.cache[require.resolve("../src/memory/memory_store")];
    const { saveMemory, searchMemory } = require("../src/memory/memory_store");
    const saved = await saveMemory({
      agent_name: "codex",
      content: "authoritative memory survives embedding cache failure",
      type: "experience",
      category: "resilience",
    });
    assert.ok(saved.id);
    assert.match(
      fs.readFileSync(path.join(cacheFailureRoot, ".mcp-agent-memory.jsonl"), "utf8"),
      /authoritative memory survives embedding cache failure/,
    );
    const fallbackSearch = await searchMemory({
      query: "authoritative memory",
      agent_name: "codex",
      top_k: 5,
      min_score: 0.1,
    });
    assert.equal(fallbackSearch.results.length, 1);
    assert.equal(fallbackSearch.results[0].id, saved.id);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [name, value] of Object.entries({
      MCP_TEST_MEMORY_LOG_DIR: previousEnv.logDir,
      MCP_TEST_MEMORY_EMBEDDING_PROVIDER: previousEnv.provider,
      MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS: previousEnv.egress,
      OVH_AI_ENDPOINTS_ACCESS_TOKEN: previousEnv.token,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(cacheFailureRoot, { recursive: true, force: true });
  }

  console.log("smoke_memory_embeddings ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
