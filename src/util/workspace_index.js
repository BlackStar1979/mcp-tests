"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { buildWorkRoots, listWorkspaceRoots, safeWorkspacePath } = require("./workspace_roots");

const DEFAULT_INDEX_FILE = path.resolve(__dirname, "..", "..", "_control", "workspace-index.json");
const MAX_INDEX_FILE_BYTES = 512 * 1024;
const MAX_INDEX_TEXT_CHARS = 12000;
const DEFAULT_MAX_FILES = 20000;
const DEFAULT_MAX_DIRS = 5000;
const STREAM_READ_BUFFER_BYTES = 64 * 1024;
const DEFAULT_INDEX_PROFILE = "knowledge";
const SKIPPED_SCAN_DIRS = new Set([
  ".archive",
  ".git",
  ".hg",
  ".svn",
  ".github_remote_archives",
  ".mcp_backups",
  ".mcp_trash",
  ".temp",
  ".venv",
  "__pycache__",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
  "target",
  "vendor",
  "_backups",
  "_control",
  "_docs",
  "_logs",
  "_public_sandbox",
  "_repos_with_code_samples",
  "_stages",
  "archive",
  ".codebase-memory",
]);
const BLOCKED_TOP_LEVEL_DIRS = new Set([
  "mcp-tests/.codebase-memory",
]);
const BLOCKED_SUBTREE_PATHS = [
  "/_workflow/control_plane/snapshots/",
  "/_workflow/control_plane/retired_root_backups/",
  "/_workflow/historical/",
];
const KNOWLEDGE_INDEX_EXTENSIONS = new Set([
  ".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".xml",
]);
const SOURCE_INDEX_EXTENSIONS = new Set([
  ".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".py", ".ps1", ".sh", ".bat", ".cmd", ".css", ".html", ".sql",
]);
const ALL_INDEX_EXTENSIONS = new Set([
  ".md", ".txt", ".json", ".yaml", ".yml", ".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".py",
  ".toml", ".ini", ".cfg", ".ps1", ".sh", ".bat", ".cmd", ".css", ".html", ".xml", ".sql",
]);
const KNOWLEDGE_BLOCKED_SUBTREE_PATHS = [
  "/_workflow/control_plane/",
  "/_workflow/historical/",
  "/_repos_with_code_samples/",
];

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

function normalizeIndexProfile(value) {
  const normalized = String(value || DEFAULT_INDEX_PROFILE).trim().toLowerCase();
  if (normalized === "all" || normalized === "source" || normalized === "knowledge") return normalized;
  return DEFAULT_INDEX_PROFILE;
}

function allowedExtensionsForProfile(profile) {
  if (profile === "all") return ALL_INDEX_EXTENSIONS;
  if (profile === "source") return SOURCE_INDEX_EXTENSIONS;
  return KNOWLEDGE_INDEX_EXTENSIONS;
}

function normalizePathFilter(value = "") {
  return normalizeSlashes(value).trim().replace(/\/+$/, "");
}

function normalizeOutputPathFilter(value = "") {
  const normalized = normalizePathFilter(value);
  return normalized || ".";
}

function pathMatchesFilter(displayPath = "", pathFilter = "") {
  const filter = normalizePathFilter(pathFilter);
  if (!filter || filter === ".") return true;
  const item = normalizePathFilter(displayPath);
  return item === filter || item.startsWith(`${filter}/`);
}

function defaultIndexScope() {
  return { path: ".", root_alias: "", display_path: ".", mode: "all_roots" };
}

function resolveIndexScope(index = {}) {
  return index.stats?.scope || index.scope || defaultIndexScope();
}

function retrievalMetadata(index = {}, pathFilter = ".") {
  return {
    index_scope: resolveIndexScope(index),
    path_filter: normalizeOutputPathFilter(pathFilter),
    index_profile: normalizeIndexProfile(index.profile || index.stats?.profile),
    index_truncated: Boolean(index.stats?.truncated),
    index_created_at: String(index.created_at || ""),
    index_count: Array.isArray(index.docs) ? index.docs.length : 0,
  };
}

function retrievalErrorMetadata(pathFilter = ".", fallbackFilter = ".") {
  return {
    index_scope: { path: "", root_alias: "", display_path: "", mode: "" },
    path_filter: normalizeOutputPathFilter(pathFilter || fallbackFilter),
    index_profile: "",
    index_truncated: false,
    index_created_at: "",
    index_count: 0,
  };
}

function shouldSkipDirectory(displayPath, profile = DEFAULT_INDEX_PROFILE) {
  const normalized = normalizeSlashes(displayPath || ".");
  if (BLOCKED_TOP_LEVEL_DIRS.has(normalized)) return true;
  const wrapped = `/${normalized}/`;
  if (BLOCKED_SUBTREE_PATHS.some((blocked) => wrapped.includes(blocked))) return true;
  if (normalizeIndexProfile(profile) === "knowledge" && KNOWLEDGE_BLOCKED_SUBTREE_PATHS.some((blocked) => wrapped.includes(blocked))) return true;
  const parts = normalized.split("/").filter(Boolean);
  return parts.some((part) => SKIPPED_SCAN_DIRS.has(part));
}

function extractTitle(displayPath, text) {
  const body = String(text || "");
  const heading = body.match(/^\s*#\s+(.+)$/m);
  if (heading) return heading[1].trim().slice(0, 160);
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      return String(parsed.title || parsed.name || parsed.schema_version || parsed.status || path.posix.basename(displayPath)).slice(0, 160);
    }
  } catch {
    // Non-JSON documents fall back to the filename.
  }
  return path.posix.basename(String(displayPath || "")).slice(0, 160);
}

function classifyDocument(displayPath, text) {
  const normalized = normalizeSlashes(displayPath || "");
  const lower = normalized.toLowerCase();
  const base = path.posix.basename(lower);
  const ext = path.posix.extname(lower);
  const title = extractTitle(normalized, text);
  let kind = "document";
  let authority = "supporting";

  if (base === "northstar.md") {
    kind = "northstar";
    authority = "source_of_truth";
  } else if (base === "state.md" || base === "state.json") {
    kind = "state";
    authority = "source_of_truth";
  } else if (base === "readiness.md") {
    kind = "readiness";
    authority = "source_of_truth";
  } else if (base === "roadmap.md") {
    kind = "roadmap";
    authority = "source_of_truth";
  } else if (base === "workflow_canon.md" || base === "active_workflow_index.md") {
    kind = "workflow";
    authority = "source_of_truth";
  } else if (/server_.*_spec\.json$/.test(base)) {
    kind = "server_spec";
    authority = "source_of_truth";
  } else if (base === "directory.md") {
    kind = "directory_map";
    authority = "orientation";
  } else if (lower.includes("/_workflow/operator_decisions/")) {
    kind = "operator_decision";
    authority = "decision_record";
  } else if (lower.includes("/docs/") || /report|review|design|plan/.test(base)) {
    kind = "report";
    authority = "supporting";
  } else if (lower.includes("/.agents/skills/")) {
    kind = "agent_skill";
    authority = "operational_guidance";
  } else if (ext === ".json" || ext === ".yaml" || ext === ".yml" || ext === ".toml") {
    kind = "structured_config";
    authority = "supporting";
  }

  return {
    title,
    kind,
    authority,
    format: ext ? ext.slice(1) : "none",
  };
}

function incrementCounter(map, key, amount = 1) {
  const name = String(key || "unknown");
  map.set(name, (map.get(name) || 0) + amount);
}

function sortedCounterItems(map, limit = 25) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function topLevelArea(displayPath) {
  const normalized = normalizeSlashes(displayPath || "").replace(/^mcp-tests\//, "");
  return normalized.split("/").filter(Boolean)[0] || ".";
}

function topTwoLevelArea(displayPath) {
  const normalized = normalizeSlashes(displayPath || "").replace(/^mcp-tests\//, "");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : (parts[0] || ".");
}

function summarizeIndexKnowledge(index = {}) {
  const docs = Array.isArray(index.docs) ? index.docs : [];
  const byKind = new Map();
  const byAuthority = new Map();
  const byFormat = new Map();
  const byArea = new Map();
  const bySubarea = new Map();
  for (const doc of docs) {
    incrementCounter(byKind, doc.kind || "document");
    incrementCounter(byAuthority, doc.authority || "supporting");
    incrementCounter(byFormat, doc.format || path.posix.extname(String(doc.path || "")).slice(1) || "none");
    incrementCounter(byArea, topLevelArea(doc.path));
    incrementCounter(bySubarea, topTwoLevelArea(doc.path));
  }
  const authorityRank = new Map([
    ["source_of_truth", 5],
    ["operational_guidance", 4],
    ["decision_record", 3],
    ["orientation", 2],
    ["supporting", 1],
  ]);
  const topAuthorityDocs = docs
    .slice()
    .sort((a, b) => {
      const rankDiff = (authorityRank.get(b.authority) || 0) - (authorityRank.get(a.authority) || 0);
      if (rankDiff) return rankDiff;
      return String(a.path || "").localeCompare(String(b.path || ""));
    })
    .slice(0, 20)
    .map((doc) => ({
      path: doc.path,
      title: String(doc.title || ""),
      kind: String(doc.kind || "document"),
      authority: String(doc.authority || "supporting"),
      modified: String(doc.modified || ""),
    }));

  return {
    profile: index.profile === "" ? "" : normalizeIndexProfile(index.profile || index.stats?.profile),
    by_kind: sortedCounterItems(byKind),
    by_authority: sortedCounterItems(byAuthority),
    by_format: sortedCounterItems(byFormat),
    top_level_areas: sortedCounterItems(byArea),
    top_subareas: sortedCounterItems(bySubarea),
    top_authority_docs: topAuthorityDocs,
  };
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
  const profile = normalizeIndexProfile(options.profile);
  const allowedExtensions = allowedExtensionsForProfile(profile);
  const rootsMap = options.roots || buildWorkRoots();
  const roots = listWorkspaceRoots(rootsMap);
  const scopePath = String(options.path || ".").trim() || ".";
  const docs = [];
  const skipped = { oversized: 0, extension: 0, directories: 0 };
  let visitedFiles = 0;
  let visitedDirs = 0;
  let truncated = false;

  async function addFileToIndex(root, full) {
    visitedFiles += 1;
    if (visitedFiles > maxFiles) {
      truncated = true;
      return;
    }
    const ext = path.extname(full).toLowerCase();
    if (!allowedExtensions.has(ext)) {
      skipped.extension += 1;
      return;
    }
    const stat = await fsp.stat(full);
    if (stat.size > MAX_INDEX_FILE_BYTES) {
      skipped.oversized += 1;
      return;
    }
    const text = await readTextPrefixStream(full, MAX_INDEX_TEXT_CHARS);
    const displayPath = displayPathForRoot(root, full);
    const classification = classifyDocument(displayPath, text);
    docs.push({
      path: displayPath,
      title: classification.title,
      kind: classification.kind,
      authority: classification.authority,
      format: classification.format,
      sample: text,
      bytes: stat.size,
      modified: stat.mtime.toISOString(),
    });
  }

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
        if (shouldSkipDirectory(displayPath, profile)) {
          skipped.directories += 1;
          continue;
        }
        await walk(root, full);
        continue;
      }
      if (!entry.isFile()) continue;
      await addFileToIndex(root, full);
    }
  }

  await fsp.mkdir(path.dirname(indexFile), { recursive: true });
  let scope;
  if (scopePath === ".") {
    scope = { path: ".", root_alias: "", display_path: ".", mode: "all_roots" };
    for (const root of roots) {
      await walk(root, root.path);
      if (truncated) break;
    }
  } else {
    const target = safeWorkspacePath(scopePath, { roots: rootsMap });
    const root = roots.find((item) => item.alias === target.rootAlias);
    if (!root) {
      throw new Error(`Unknown workspace root alias: ${target.rootAlias}`);
    }
    const stat = await fsp.stat(target.absolutePath);
    scope = {
      path: target.requested,
      root_alias: target.rootAlias,
      display_path: target.displayPath,
      mode: stat.isDirectory() ? "directory" : "file",
    };
    if (stat.isDirectory()) {
      await walk(root, target.absolutePath);
    } else if (stat.isFile()) {
      await addFileToIndex(root, target.absolutePath);
    } else {
      throw new Error(`Path is not a file or directory: ${scopePath}`);
    }
  }

  const index = {
    version: 2,
    created_at: new Date().toISOString(),
    root: ".",
    roots: roots.map((item) => ({ alias: item.alias, path: item.path, primary: item.primary })),
    scope,
    profile,
    docs,
    stats: {
      docs: docs.length,
      profile,
      visited_files: visitedFiles,
      visited_dirs: visitedDirs,
      skipped,
      truncated,
      max_files: maxFiles,
      max_dirs: maxDirs,
      scope,
      max_index_file_bytes: MAX_INDEX_FILE_BYTES,
      max_index_text_chars: MAX_INDEX_TEXT_CHARS,
      knowledge_summary: summarizeIndexKnowledge({ docs, profile }),
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
  const title = normalizeQuery(doc.title);
  const kind = normalizeQuery(doc.kind);
  const authority = normalizeQuery(doc.authority);
  const { base, stem, segments } = basenameInfo(doc.path);
  let score = 0;
  if (!q && terms.length === 0) return 0;
  if (q && p.includes(q)) score += 30;
  if (q && title.includes(q)) score += 35;
  if (q && sample.includes(q)) score += 20;
  for (const term of terms) {
    if (p.includes(term)) score += 10;
    if (segments.includes(term)) score += 16;
    if (stem === term) score += 120;
    else if (base === term) score += 100;
    else if (stem.includes(term)) score += 18;
    else if (base.includes(term)) score += 12;
    if (title.includes(term)) score += 14;
    if (kind.includes(term)) score += 18;
    if (authority.includes(term)) score += 12;
    if (sample.includes(term)) score += 3;
  }
  if (doc.authority === "source_of_truth") score += 18;
  if (doc.authority === "operational_guidance") score += 10;
  if (doc.kind === "northstar" || doc.kind === "state" || doc.kind === "readiness" || doc.kind === "roadmap") score += 18;
  if (p.startsWith("romionsim/")) score += 8;
  if (p.includes("readme")) score += 4;
  if (p.startsWith("mcp-tests/src/")) score += 2;
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

function rankDocs(index, query, { limit = 10, romionsimOnly = false, pathFilter = "" } = {}) {
  return (index.docs || [])
    .filter((doc) => !romionsimOnly || String(doc.path || "").startsWith("romionsim/"))
    .filter((doc) => pathMatchesFilter(doc.path, pathFilter))
    .map((doc) => ({
      path: doc.path,
      title: String(doc.title || ""),
      kind: String(doc.kind || "document"),
      authority: String(doc.authority || "supporting"),
      format: String(doc.format || path.posix.extname(String(doc.path || "")).slice(1) || "none"),
      score: scoreDoc(doc, query),
      snippet: buildSnippet(doc, query),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
}

function importantRomionsimDocs(index, pathFilter = "romionsim") {
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
    .filter((item) => pathMatchesFilter(item, pathFilter))
    .filter((item) => byPath.has(item))
    .map((item) => ({
      path: item,
      title: String(byPath.get(item)?.title || ""),
      kind: String(byPath.get(item)?.kind || "document"),
      authority: String(byPath.get(item)?.authority || "supporting"),
      format: String(byPath.get(item)?.format || path.posix.extname(item).slice(1) || "none"),
      score: 100,
      snippet: buildSnippet(byPath.get(item), "romionsim"),
      role: "pinned_context",
    }));
}

async function indexStatus(options = {}) {
  try {
    const index = await loadWorkspaceIndex(options);
    const stats = index.stats || {};
    const skipped = stats.skipped || {};
    return {
      success: true,
      error: "",
      status: "ok",
      count: Array.isArray(index.docs) ? index.docs.length : 0,
      created_at: String(index.created_at || ""),
      root: String(index.root || "."),
      version: Number(index.version || 0),
      roots: Array.isArray(index.roots) ? index.roots : [],
      scope: stats.scope || index.scope || defaultIndexScope(),
      profile: normalizeIndexProfile(index.profile || stats.profile),
      visited_files: Number(stats.visited_files || 0),
      visited_dirs: Number(stats.visited_dirs || 0),
      truncated: Boolean(stats.truncated),
      max_files: Number(stats.max_files || 0),
      max_dirs: Number(stats.max_dirs || 0),
      knowledge_summary: stats.knowledge_summary || summarizeIndexKnowledge(index),
      skipped: {
        oversized: Number(skipped.oversized || 0),
        extension: Number(skipped.extension || 0),
        directories: Number(skipped.directories || 0),
      },
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
        scope: { path: "", root_alias: "", display_path: "", mode: "" },
        profile: "",
        visited_files: 0,
        visited_dirs: 0,
        truncated: false,
        max_files: 0,
        max_dirs: 0,
        knowledge_summary: summarizeIndexKnowledge({ docs: [], profile: "" }),
        skipped: { oversized: 0, extension: 0, directories: 0 },
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
      scope: { path: "", root_alias: "", display_path: "", mode: "" },
      profile: "",
      visited_files: 0,
      visited_dirs: 0,
      truncated: false,
      max_files: 0,
      max_dirs: 0,
      knowledge_summary: summarizeIndexKnowledge({ docs: [], profile: "" }),
      skipped: { oversized: 0, extension: 0, directories: 0 },
    };
  }
}

async function searchIndex(query, { limit = 10, indexFile, path } = {}) {
  const index = await loadWorkspaceIndex({ indexFile });
  const pathFilter = path || ".";
  return {
    success: true,
    error: "",
    status: "ok",
    query: String(query || ""),
    ...retrievalMetadata(index, pathFilter),
    results: rankDocs(index, query, { limit, pathFilter }),
  };
}

async function searchIndexContext(query, { limit = 5, indexFile, path } = {}) {
  const index = await loadWorkspaceIndex({ indexFile });
  const pathFilter = path || ".";
  return {
    success: true,
    error: "",
    status: "ok",
    query: String(query || ""),
    ...retrievalMetadata(index, pathFilter),
    results: rankDocs(index, query, { limit, pathFilter }).map((item) => ({
      path: item.path,
      title: item.title,
      kind: item.kind,
      authority: item.authority,
      format: item.format,
      score: item.score,
      context: item.snippet,
    })),
  };
}

async function collectContext(query, { limit = 8, maxCharsPerFile = 8000, indexFile, path } = {}) {
  const index = await loadWorkspaceIndex({ indexFile });
  const pathFilter = path || ".";
  const byPath = new Map((index.docs || []).map((doc) => [doc.path, doc]));
  return {
    success: true,
    error: "",
    status: "ok",
    query: String(query || ""),
    ...retrievalMetadata(index, pathFilter),
    files: rankDocs(index, query, { limit, pathFilter }).map((item) => {
      const doc = byPath.get(item.path);
      return {
        path: item.path,
        title: item.title,
        kind: item.kind,
        authority: item.authority,
        format: item.format,
        score: item.score,
        text: String(doc?.sample || "").slice(0, maxCharsPerFile),
      };
    }),
  };
}

async function collectRomionsimContext(query, { limit = 12, includePinned = true, indexFile, path } = {}) {
  const index = await loadWorkspaceIndex({ indexFile });
  const pathFilter = path || "romionsim";
  const pinned = includePinned ? importantRomionsimDocs(index, pathFilter) : [];
  const ranked = rankDocs(index, query, { limit, romionsimOnly: true, pathFilter });
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
    ...retrievalMetadata(index, pathFilter),
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
  retrievalErrorMetadata,
  searchIndex,
  searchIndexContext,
};
