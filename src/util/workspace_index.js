"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { buildWorkRoots, listWorkspaceRoots } = require("./workspace_roots");

const DEFAULT_INDEX_FILE = path.resolve(__dirname, "..", "..", "_control", "workspace-index.json");
const MAX_INDEX_FILE_BYTES = 512 * 1024;
const MAX_INDEX_TEXT_CHARS = 12000;
const DEFAULT_MAX_FILES = 20000;
const DEFAULT_MAX_DIRS = 5000;
const STREAM_READ_BUFFER_BYTES = 64 * 1024;
const SKIPPED_SCAN_DIRS = new Set([
  ".archive",
  ".git",
  ".hg",
  ".svn",
  ".github_remote_archives",
  ".mcp_backups",
  ".mcp_trash",
  ".temp",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
  "_logs",
  ".codebase-memory",
]);
const BLOCKED_TOP_LEVEL_DIRS = new Set([
  "mcp-tests/.codebase-memory",
]);
const ALLOWED_INDEX_EXTENSIONS = new Set([
  ".md", ".txt", ".json", ".yaml", ".yml", ".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".py",
  ".toml", ".ini", ".cfg", ".ps1", ".sh", ".bat", ".cmd", ".css", ".html", ".xml", ".sql",
]);

function normalizeSlashes(value) {
  return String(value || "").replaceAll("\\", "/");
}

function getIndexFile(options = {}) {
  return options.indexFile || process.env.MCP_TEST_WORKSPACE_INDEX_FILE || DEFAULT_INDEX_FILE;
}

function tokenList(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, " ")
    .split(/\s+/)
    .filter((item) => item.length >= 2);
}

function normalizeQuery(text) {
  return String(text || "").toLowerCase().trim();
}

function basenameInfo(displayPath = "") {
  const normalized = normalizeSlashes(displayPath);
  const base = path.posix.basename(normalized).toLowerCase();
  const ext = path.posix.extname(base);
  const stem = ext ? base.slice(0, -ext.length) : base;
  const segments = normalized.toLowerCase().split("/").filter(Boolean);
  return { base, stem, segments };
}

function shouldSkipDirectory(displayPath) {
  const normalized = normalizeSlashes(displayPath || ".");
  if (BLOCKED_TOP_LEVEL_DIRS.has(normalized)) return true;
  const parts = normalized.split("/").filter(Boolean);
  return parts.some((part) => SKIPPED_SCAN_DIRS.has(part));
}

function displayPathForRoot(root, absolutePath) {
  const rel = normalizeSlashes(path.relative(root.path, absolutePath));
  if (!rel || rel === ".") {
    return root.primary ? "." : `@${root.alias}`;
  }
  return root.primary ? rel : `@${root.alias}/${rel}`;
}

function appendBoundedText(current, addition, maxChars) {
  if (!addition) return { text: current, truncated: false };
  if (current.length >= maxChars) return { text: current, truncated: true };

  const remaining = maxChars - current.length;
  if (addition.length > remaining) {
    return { text: current + addition.slice(0, remaining), truncated: true };
  }

  return { text: current + addition, truncated: false };
}

async function readTextPrefixStream(absolutePath, maxChars) {
  const limit = Math.max(0, Number(maxChars) || MAX_INDEX_TEXT_CHARS);
  let text = "";
  const stream = fs.createReadStream(absolutePath, {
    encoding: "utf8",
    highWaterMark: STREAM_READ_BUFFER_BYTES,
  });

  for await (const chunk of stream) {
    const appended = appendBoundedText(text, chunk, limit);
    text = appended.text;
    if (appended.truncated) {
      break;
    }
  }

  return text;
}

async function loadWorkspaceIndex(options = {}) {
  const indexFile = getIndexFile(options);
  return JSON.parse(await fsp.readFile(indexFile, "utf8"));
}

async function buildWorkspaceIndex(options = {}) {
  const indexFile = getIndexFile(options);
  const maxFiles = Number.isInteger(options.max_files) ? options.max_files : DEFAULT_MAX_FILES;
  const maxDirs = Number.isInteger(options.max_dirs) ? options.max_dirs : DEFAULT_MAX_DIRS;
  const rootsMap = options.roots || buildWorkRoots();
  const roots = listWorkspaceRoots(rootsMap);
  const docs = [];
  const skipped = { oversized: 0, extension: 0, directories: 0 };
  let visitedFiles = 0;
  let visitedDirs = 0;
  let truncated = false;

  async function walk(root, dir) {
    if (truncated) return;
    visitedDirs += 1;
    if (visitedDirs > maxDirs) {
      truncated = true;
      return;
    }
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (truncated) return;
      const full = path.join(dir, entry.name);
      const displayPath = displayPathForRoot(root, full);
      if (entry.isDirectory()) {
        if (shouldSkipDirectory(displayPath)) {
          skipped.directories += 1;
          continue;
        }
        await walk(root, full);
        continue;
      }
      if (!entry.isFile()) continue;
      visitedFiles += 1;
      if (visitedFiles > maxFiles) {
        truncated = true;
        return;
      }
      const ext = path.extname(full).toLowerCase();
      if (!ALLOWED_INDEX_EXTENSIONS.has(ext)) {
        skipped.extension += 1;
        continue;
      }
      const stat = await fsp.stat(full);
      if (stat.size > MAX_INDEX_FILE_BYTES) {
        skipped.oversized += 1;
        continue;
      }
      const text = await readTextPrefixStream(full, MAX_INDEX_TEXT_CHARS);
      docs.push({
        path: displayPath,
        sample: text,
        bytes: stat.size,
        modified: stat.mtime.toISOString(),
      });
    }
  }

  await fsp.mkdir(path.dirname(indexFile), { recursive: true });
  for (const root of roots) {
    await walk(root, root.path);
    if (truncated) break;
  }

  const index = {
    version: 1,
    created_at: new Date().toISOString(),
    root: ".",
    roots: roots.map((item) => ({ alias: item.alias, path: item.path, primary: item.primary })),
    docs,
    stats: {
      docs: docs.length,
      visited_files: visitedFiles,
      visited_dirs: visitedDirs,
      skipped,
      truncated,
      max_files: maxFiles,
      max_dirs: maxDirs,
      max_index_file_bytes: MAX_INDEX_FILE_BYTES,
      max_index_text_chars: MAX_INDEX_TEXT_CHARS,
    },
  };

  await fsp.writeFile(indexFile, JSON.stringify(index, null, 2));
  return index;
}

function scoreDoc(doc, query) {
  const q = normalizeQuery(query);
  const terms = tokenList(query);
  const p = normalizeQuery(doc.path);
  const sample = normalizeQuery(doc.sample);
  const { base, stem, segments } = basenameInfo(doc.path);
  let score = 0;
  if (!q && terms.length === 0) return 0;
  if (q && p.includes(q)) score += 30;
  if (q && sample.includes(q)) score += 20;
  for (const term of terms) {
    if (p.includes(term)) score += 10;
    if (segments.includes(term)) score += 16;
    if (stem === term) score += 120;
    else if (base === term) score += 100;
    else if (stem.includes(term)) score += 18;
    else if (base.includes(term)) score += 12;
    if (sample.includes(term)) score += 3;
  }
  if (p.startsWith("romionsim/")) score += 8;
  if (p.includes("readme")) score += 4;
  if (p.startsWith("mcp-tests/src/")) score += 4;
  return score;
}

function buildSnippet(doc, query, maxLen = 700) {
  const sample = String(doc.sample || "");
  const lower = normalizeQuery(sample);
  const terms = tokenList(query);
  let pos = -1;
  for (const term of terms) {
    const found = lower.indexOf(term);
    if (found >= 0 && (pos < 0 || found < pos)) pos = found;
  }
  const start = Math.max(0, (pos < 0 ? 0 : pos) - 180);
  return sample.slice(start, start + maxLen).replace(/\s+/g, " ").trim();
}

function rankDocs(index, query, { limit = 10, romionsimOnly = false } = {}) {
  return (index.docs || [])
    .filter((doc) => !romionsimOnly || String(doc.path || "").startsWith("romionsim/"))
    .map((doc) => ({
      path: doc.path,
      score: scoreDoc(doc, query),
      snippet: buildSnippet(doc, query),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
}

function importantRomionsimDocs(index) {
  const wanted = [
    "romionsim/workflow/NEXT_SESSION_START.md",
    "romionsim/workflow/ENGINE_TEST_GRID.md",
    "romionsim/workflow/PROJECT_WORKING_MEMORY.md",
    "romionsim/docs/README.md",
    "romionsim/docs/INDEX.md",
    "romionsim/docs/ARCHITECTURE.md",
    "romionsim/validation/README.md",
  ];
  const byPath = new Map((index.docs || []).map((doc) => [doc.path, doc]));
  return wanted
    .filter((item) => byPath.has(item))
    .map((item) => ({
      path: item,
      score: 100,
      snippet: buildSnippet(byPath.get(item), "romionsim"),
      role: "pinned_context",
    }));
}

async function indexStatus(options = {}) {
  try {
    const index = await loadWorkspaceIndex(options);
    return {
      success: true,
      error: "",
      status: "ok",
      count: Array.isArray(index.docs) ? index.docs.length : 0,
      created_at: String(index.created_at || ""),
      root: String(index.root || "."),
      version: Number(index.version || 0),
      roots: Array.isArray(index.roots) ? index.roots : [],
    };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      return {
        success: false,
        error: error?.message || String(error),
        status: "error",
        count: 0,
        created_at: "",
        root: ".",
        version: 0,
        roots: [],
      };
    }
    return {
      success: true,
      error: "",
      status: "missing",
      count: 0,
      created_at: "",
      root: ".",
      version: 0,
      roots: [],
    };
  }
}

async function searchIndex(query, { limit = 10, indexFile } = {}) {
  const index = await loadWorkspaceIndex({ indexFile });
  return {
    success: true,
    error: "",
    status: "ok",
    query: String(query || ""),
    results: rankDocs(index, query, { limit }),
  };
}

async function searchIndexContext(query, { limit = 5, indexFile } = {}) {
  const index = await loadWorkspaceIndex({ indexFile });
  return {
    success: true,
    error: "",
    status: "ok",
    query: String(query || ""),
    results: rankDocs(index, query, { limit }).map((item) => ({
      path: item.path,
      score: item.score,
      context: item.snippet,
    })),
  };
}

async function collectContext(query, { limit = 8, maxCharsPerFile = 8000, indexFile } = {}) {
  const index = await loadWorkspaceIndex({ indexFile });
  const byPath = new Map((index.docs || []).map((doc) => [doc.path, doc]));
  return {
    success: true,
    error: "",
    status: "ok",
    query: String(query || ""),
    files: rankDocs(index, query, { limit }).map((item) => {
      const doc = byPath.get(item.path);
      return {
        path: item.path,
        score: item.score,
        text: String(doc?.sample || "").slice(0, maxCharsPerFile),
      };
    }),
  };
}

async function collectRomionsimContext(query, { limit = 12, includePinned = true, indexFile } = {}) {
  const index = await loadWorkspaceIndex({ indexFile });
  const pinned = includePinned ? importantRomionsimDocs(index) : [];
  const ranked = rankDocs(index, query, { limit, romionsimOnly: true });
  const seen = new Set();
  const files = [];
  for (const item of [...pinned, ...ranked]) {
    if (seen.has(item.path)) continue;
    seen.add(item.path);
    files.push(item);
  }
  return {
    success: true,
    error: "",
    status: "ok",
    query: String(query || ""),
    scope: "romionsim/",
    mode: "retrieval_helper_only",
    count: files.length,
    files,
  };
}

module.exports = {
  DEFAULT_INDEX_FILE,
  buildWorkspaceIndex,
  collectContext,
  collectRomionsimContext,
  indexStatus,
  loadWorkspaceIndex,
  searchIndex,
  searchIndexContext,
};
