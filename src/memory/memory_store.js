"use strict";

/**
 * memory_store.js — file-based shared memory for MCP agents.
 *
 * Storage layout (all files in _logs/):
 *   .mcp-agent-state.json   — JSON object keyed by agent_name (upsert, atomic write)
 *   .mcp-agent-memory.jsonl — append-only JSONL of memory entries
 *   .mcp-agent-tasks.jsonl  — append-only JSONL of task entries
 *
 * Search: keyword term-overlap scoring (no external deps).
 * Writes are atomic: temp-file + rename to avoid partial reads.
 */

const fsp  = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

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
  return entry;
}

/**
 * Score an entry against a set of query tokens.
 * Returns a value in [0, 1]: fraction of query tokens present in entry text.
 * Checks content and category; case-insensitive.
 */
function scoreEntry(entry, tokens) {
  if (!tokens.length) return 0;
  const haystack = (entry.content + " " + (entry.category || "")).toLowerCase();
  const hits = tokens.reduce((n, t) => n + (haystack.includes(t) ? 1 : 0), 0);
  return hits / tokens.length;
}

/**
 * Keyword search over non-archived memory entries.
 * Returns scored results sorted descending, capped at top_k.
 */
async function searchMemory({ query, agent_name, top_k = 5, min_score = 0.1 }) {
  const all = await readJsonl(memoryFile());
  // Filter archived entries first, then by agent if specified
  const active = all.filter((e) => !e.is_archived);
  const pool   = agent_name ? active.filter((e) => e.agent_name === agent_name) : active;

  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);

  const scored = pool
    .map((e) => ({ ...e, score: scoreEntry(e, tokens) }))
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
