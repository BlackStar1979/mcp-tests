"use strict";

/**
 * memory_store.js — file-based shared memory for MCP agents.
 *
 * Storage layout (all files in _logs/):
 *   .mcp-agent-state.json   — JSON object keyed by agent_name (upsert, atomic write)
 *   .mcp-agent-memory.jsonl — append-only JSONL of memory entries
 *   .mcp-agent-tasks.jsonl  — append-only JSONL of task entries
 *
 * Search: keyword scoring with an opt-in OVH embedding sidecar.
 * Memory writes are append-only; task rewrites use temp-file + rename.
 */

const fsp  = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  BGE_M3_DIMENSIONS,
  createEmbeddingClient,
  cosineSimilarity,
} = require("./embedding_client");
const {
  contentHash,
  loadCachedEmbeddings,
  storeCachedEmbedding,
} = require("./embedding_cache");

const LEXICAL_QUERY_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "is", "it",
  "of", "on", "or", "that", "the", "this", "to", "was", "what", "when", "where", "which", "who", "with",
  "aby", "albo", "ale", "bo", "byc", "być", "co", "czy", "do", "gdzie", "i", "jak", "jest", "na",
  "nie", "o", "od", "oraz", "po", "przy", "sie", "się", "to", "w", "z", "za", "ze",
]);

function getLogsDir() {
  return process.env.MCP_TEST_MEMORY_LOG_DIR
    ? path.resolve(process.env.MCP_TEST_MEMORY_LOG_DIR)
    : path.join(__dirname, "../../_logs");
}

function stateFile() { return path.join(getLogsDir(), ".mcp-agent-state.json"); }
function memoryFile() { return path.join(getLogsDir(), ".mcp-agent-memory.jsonl"); }
function tasksFile() { return path.join(getLogsDir(), ".mcp-agent-tasks.jsonl"); }

// ── Helpers ───────────────────────────────────────────────────────────────────

function newId() {
  return crypto.randomUUID();
}

/** Parse a JSONL file; silently skip malformed lines and missing file. */
async function readJsonl(filePath) {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

/** Atomic write: write to .tmp then rename. */
async function atomicWrite(filePath, content) {
  const tmp = filePath + ".tmp." + Date.now();
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(tmp, content, "utf8");
  await fsp.rename(tmp, filePath);
}

// ── Agent state ───────────────────────────────────────────────────────────────

async function readStateMap() {
  try {
    const raw = await fsp.readFile(stateFile(), "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT" || err instanceof SyntaxError) return {};
    throw err;
  }
}

/**
 * Get the current state for one agent.
 * Returns null if no state has been set yet.
 */
async function getAgentState(agentName) {
  const map = await readStateMap();
  return map[agentName] || null;
}

/**
 * Upsert the state for one agent.
 * Merges provided fields over any existing state; always updates updated_at.
 */
async function setAgentState(agentName, fields = {}) {
  const map = await readStateMap();
  const prev = map[agentName] || {};
  map[agentName] = {
    agent_name:   agentName,
    session_id:   fields.session_id   ?? prev.session_id   ?? "",
    current_task: fields.current_task ?? prev.current_task ?? "",
    context:      fields.context      ?? prev.context      ?? {},
    updated_at:   new Date().toISOString(),
  };
  await atomicWrite(stateFile(), JSON.stringify(map, null, 2));
  return map[agentName];
}

// ── Memory entries ────────────────────────────────────────────────────────────

/**
 * Save a new memory entry.
 * Appends to JSONL — O(1), never rewrites existing data.
 */
async function saveMemory({ agent_name, content, type = "fact", category = "" }) {
  const entry = {
    id:          newId(),
    agent_name,
    type,
    content,
    category:    category || "",
    is_archived: false,
    created_at:  new Date().toISOString(),
  };
  const filePath = memoryFile();
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.appendFile(filePath, JSON.stringify(entry) + "\n", "utf8");

  const generated = await createEmbeddingClient().generate(content);
  if (generated.status === "ok") {
    try {
      storeCachedEmbedding({
        logDir: getLogsDir(),
        text: content,
        provider: generated.provider,
        model: generated.model,
        dimensions: generated.dimensions,
        vector: generated.vector,
      });
    } catch {
      // The append-only memory entry is authoritative; cache failure must not invite a duplicate retry.
    }
  }
  return entry;
}

/**
 * Score an entry against a set of query tokens.
 * Returns a value in [0, 1]: fraction of query tokens present in entry text.
 * Checks content and category; case-insensitive.
 */
function scoreEntry(entry, tokens) {
  if (!tokens.length) return 0;
  const haystack = new Set(tokenizeSearchText(entry.content + " " + (entry.category || "")));
  const hits = tokens.reduce((n, token) => n + (haystack.has(token) ? 1 : 0), 0);
  return hits / tokens.length;
}

function tokenizeSearchText(text, { removeStopWords = false } = {}) {
  return [...new Set(String(text || "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])]
    .filter((token) => token.length > 1)
    .filter((token) => !removeStopWords || !LEXICAL_QUERY_STOP_WORDS.has(token));
}

function semanticRelevance(similarity) {
  const floor = 0.45;
  return Math.max(0, Math.min(1, (similarity - floor) / (1 - floor)));
}

/**
 * Hybrid search over non-archived memory entries.
 * Returns scored results sorted descending, capped at top_k.
 */
async function searchMemory({ query, agent_name, top_k = 5, min_score = 0.1 }) {
  const all = await readJsonl(memoryFile());
  // Filter archived entries first, then by agent if specified
  const active = all.filter((e) => !e.is_archived);
  const pool   = agent_name ? active.filter((e) => e.agent_name === agent_name) : active;

  const tokens = tokenizeSearchText(query, { removeStopWords: true });
  const lexicalScores = new Map(pool.map((entry) => [entry.id, scoreEntry(entry, tokens)]));
  const generated = await createEmbeddingClient().generate(query);
  let cached = new Map();
  if (generated.status === "ok") {
    try {
      cached = loadCachedEmbeddings({
        logDir: getLogsDir(),
        texts: pool.map((entry) => entry.content),
        provider: generated.provider,
        model: generated.model,
        dimensions: BGE_M3_DIMENSIONS,
      });
    } catch {
      cached = new Map();
    }
  }

  const scored = pool
    .map((entry) => {
      const lexicalScore = lexicalScores.get(entry.id) || 0;
      const cachedVector = cached.get(contentHash(entry.content));
      if (!cachedVector || generated.status !== "ok") return { ...entry, score: lexicalScore };

      const semanticScore = semanticRelevance(cosineSimilarity(generated.vector, cachedVector));
      const hybridScore = (0.8 * semanticScore) + (0.2 * lexicalScore);
      return { ...entry, score: Math.max(lexicalScore, hybridScore) };
    })
    .filter((e) => e.score >= min_score)
    .sort((a, b) => b.score - a.score)
    .slice(0, top_k);

  return { results: scored, total_searched: pool.length };
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

/**
 * Create a new task and append it to the tasks JSONL.
 */
async function createTask({ created_by, assigned_to = "", title, description = "", priority = 5 }) {
  const task = {
    id:          newId(),
    created_by,
    assigned_to: assigned_to || "",
    title,
    description,
    priority,
    status:      "pending",
    created_at:  new Date().toISOString(),
  };
  const filePath = tasksFile();
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.appendFile(filePath, JSON.stringify(task) + "\n", "utf8");
  return task;
}

/**
 * Get tasks by status and optional assignee.
 * Unassigned tasks (assigned_to === "") are returned for any assignee filter.
 * Sorted: higher priority first, then newest first within same priority.
 */
async function getTasks({ assigned_to, status = "pending", limit = 20 }) {
  const all = await readJsonl(tasksFile());

  let filtered = all.filter((t) => t.status === status);

  if (assigned_to) {
    filtered = filtered.filter(
      (t) => t.assigned_to === assigned_to || t.assigned_to === ""
    );
  }

  filtered.sort((a, b) => {
    const pd = b.priority - a.priority;
    if (pd !== 0) return pd;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return filtered.slice(0, limit);
}

module.exports = {
  getAgentState,
  setAgentState,
  saveMemory,
  searchMemory,
  createTask,
  getTasks,
};
