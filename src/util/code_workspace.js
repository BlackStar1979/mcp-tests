const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");
const MAX_CODE_FILE_BYTES = 2 * 1024 * 1024;
const MAX_SYMBOLS = 1000;
const MAX_GRAPH_FILES = 1000;
const MAX_GRAPH_EDGES = 2000;

const DENY_DIRS = new Set([
  "node_modules",
  ".git",
  ".hg",
  ".svn",
  ".secrets",
  ".temp",
  ".mcp_trash",
  ".mcp_backups",
  "_backups",
]);

const CODE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py"]);
const JS_CHECK_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);
const PY_CHECK_EXTENSIONS = new Set([".py"]);

function toPosix(input) {
  return String(input || "").replace(/\\/g, "/");
}

function normalizeWorkspacePath(input, { allowDirectory = true } = {}) {
  const raw = toPosix(input).trim();
  if (!raw) throw new Error("Path is required.");
  if (raw.length > 1000) throw new Error("Path is too long.");
  if (raw.includes("\u0000")) throw new Error("Path contains NUL byte.");
  if (raw.startsWith("/") || raw.startsWith("//")) throw new Error("Absolute paths are not allowed.");
  if (/^[A-Za-z]:/.test(raw)) throw new Error("Drive-letter paths are not allowed.");

  const parts = raw.split("/").filter((part) => part && part !== ".");
  if (!parts.length) return ".";

  for (const part of parts) {
    if (part === "..") throw new Error("Path traversal is not allowed.");
    if (DENY_DIRS.has(part)) throw new Error(`Denied workspace segment: ${part}`);
    if (part.startsWith(".") && part !== ".well-known") throw new Error("Dot path segments are not allowed.");
  }

  const normalized = parts.join("/");
  if (!allowDirectory && !CODE_EXTENSIONS.has(path.extname(normalized).toLowerCase())) {
    throw new Error("Unsupported code file extension.");
  }
  return normalized;
}

function resolveWorkspacePath(input, options = {}) {
  const rel = normalizeWorkspacePath(input, options);
  const abs = path.resolve(WORKSPACE_ROOT, rel === "." ? "" : rel);
  const rootWithSep = WORKSPACE_ROOT.endsWith(path.sep) ? WORKSPACE_ROOT : `${WORKSPACE_ROOT}${path.sep}`;
  if (abs !== WORKSPACE_ROOT && !abs.startsWith(rootWithSep)) {
    throw new Error("Resolved path escapes workspace root.");
  }
  return { absolute_path: abs, relative_path: rel };
}

async function statCodeFile(input) {
  const resolved = resolveWorkspacePath(input, { allowDirectory: false });
  const stat = await fsp.stat(resolved.absolute_path);
  if (!stat.isFile()) throw new Error("Path is not a file.");
  if (stat.size > MAX_CODE_FILE_BYTES) throw new Error(`Code file too large: ${stat.size} bytes.`);
  return { ...resolved, stat };
}

function linesOf(text) {
  return String(text || "").split(/\r\n|\n|\r/);
}

function addSymbol(symbols, item) {
  if (symbols.length < MAX_SYMBOLS) symbols.push(item);
}

function extractJsSymbols(text) {
  const symbols = [];
  const lines = linesOf(text);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const n = i + 1;
    let m;
    m = line.match(/^\s*export\s+function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (m) { addSymbol(symbols, { kind: "function", name: m[1], line: n, exported: true }); continue; }
    m = line.match(/^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (m) { addSymbol(symbols, { kind: "function", name: m[1], line: n, exported: false }); continue; }
    m = line.match(/^\s*async\s+function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (m) { addSymbol(symbols, { kind: "function", name: m[1], line: n, exported: false, async: true }); continue; }
    m = line.match(/^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/);
    if (m) { addSymbol(symbols, { kind: "variable", name: m[1], line: n, exported: true }); continue; }
    m = line.match(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?[^=]*\)?\s*=>/);
    if (m) { addSymbol(symbols, { kind: "function", name: m[1], line: n, exported: false }); continue; }
    m = line.match(/^\s*export\s+class\s+([A-Za-z_$][\w$]*)\b/);
    if (m) { addSymbol(symbols, { kind: "class", name: m[1], line: n, exported: true }); continue; }
    m = line.match(/^\s*class\s+([A-Za-z_$][\w$]*)\b/);
    if (m) { addSymbol(symbols, { kind: "class", name: m[1], line: n, exported: false }); continue; }
    m = line.match(/^\s*import\s+(.+?)\s+from\s+["'](.+?)["']/);
    if (m) { addSymbol(symbols, { kind: "import", name: m[1].trim(), source: m[2], line: n }); continue; }
    m = line.match(/^\s*(?:const|let|var)\s+.+?=\s*require\(["'](.+?)["']\)/);
    if (m) { addSymbol(symbols, { kind: "import", name: "require", source: m[1], line: n }); continue; }
  }
  return symbols;
}

function extractPySymbols(text) {
  const symbols = [];
  const lines = linesOf(text);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const n = i + 1;
    let m;
    m = line.match(/^\s*async\s+def\s+([A-Za-z_][\w]*)\s*\(/);
    if (m) { addSymbol(symbols, { kind: "function", name: m[1], line: n, async: true }); continue; }
    m = line.match(/^\s*def\s+([A-Za-z_][\w]*)\s*\(/);
    if (m) { addSymbol(symbols, { kind: "function", name: m[1], line: n }); continue; }
    m = line.match(/^\s*class\s+([A-Za-z_][\w]*)\b/);
    if (m) { addSymbol(symbols, { kind: "class", name: m[1], line: n }); continue; }
    m = line.match(/^\s*from\s+([A-Za-z_][\w.]*|\.+[A-Za-z_][\w.]*)\s+import\s+(.+)/);
    if (m) { addSymbol(symbols, { kind: "import", source: m[1], name: m[2].trim(), line: n }); continue; }
    m = line.match(/^\s*import\s+(.+)/);
    if (m) { addSymbol(symbols, { kind: "import", name: m[1].trim(), line: n }); continue; }
  }
  return symbols;
}

function languageForPath(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  if ([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"].includes(ext)) return "javascript";
  if (ext === ".py") return "python";
  return "unsupported";
}

function extractSymbols(relPath, text) {
  const language = languageForPath(relPath);
  if (language === "javascript") return { language, symbols: extractJsSymbols(text) };
  if (language === "python") return { language, symbols: extractPySymbols(text) };
  return { language, symbols: [] };
}

async function codeSymbols(filePath) {
  const item = await statCodeFile(filePath);
  const text = await fsp.readFile(item.absolute_path, "utf8");
  const { language, symbols } = extractSymbols(item.relative_path, text);
  return {
    path: item.relative_path,
    language,
    bytes: item.stat.size,
    total_lines: linesOf(text).length,
    symbol_count: symbols.length,
    truncated: symbols.length >= MAX_SYMBOLS,
    symbols,
  };
}

function previewLine(line, maxChars = 160) {
  const clean = String(line || "").replace(/\t/g, "  ").trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(0, maxChars - 1))}…`;
}

function lineHash(line) {
  return crypto.createHash("sha256").update(String(line || "")).digest("hex").slice(0, 16);
}

function findLiteralColumn(line, query, caseSensitive) {
  const haystack = caseSensitive ? line : line.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const index = haystack.indexOf(needle);
  return index >= 0 ? index + 1 : 0;
}

function escapeRegExp(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function findIdentifierColumn(line, query, caseSensitive) {
  const escaped = escapeRegExp(query);
  const flags = caseSensitive ? "" : "i";
  const re = new RegExp(`(^|[^A-Za-z0-9_$])(${escaped})(?=$|[^A-Za-z0-9_$])`, flags);
  const match = line.match(re);
  if (!match || match.index === undefined) return 0;
  return match.index + String(match[1] || "").length + 1;
}

async function locateCode(filePath, query, options = {}) {
  const item = await statCodeFile(filePath);
  const text = await fsp.readFile(item.absolute_path, "utf8");
  const lines = linesOf(text);
  const needle = String(query || "");
  if (!needle.trim()) throw new Error("Query is required.");
  if (needle.length > 200) throw new Error("Query is too long.");

  const mode = ["literal", "identifier"].includes(options.mode) ? options.mode : "literal";
  const caseSensitive = options.case_sensitive !== false;
  const maxMatches = Math.min(Math.max(Number(options.max_matches || 20), 1), 100);
  const includePreview = options.include_preview === true;
  const previewChars = Math.min(Math.max(Number(options.preview_chars || 160), 20), 240);
  const matches = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const column = mode === "identifier"
      ? findIdentifierColumn(line, needle, caseSensitive)
      : findLiteralColumn(line, needle, caseSensitive);
    if (!column) continue;
    matches.push({
      line: i + 1,
      column,
      line_sha256_prefix: lineHash(line),
      preview: includePreview ? previewLine(line, previewChars) : "",
    });
    if (matches.length >= maxMatches) break;
  }

  const totalMatchesEstimate = matches.length < maxMatches
    ? matches.length
    : lines.reduce((count, line) => {
        const column = mode === "identifier"
          ? findIdentifierColumn(line, needle, caseSensitive)
          : findLiteralColumn(line, needle, caseSensitive);
        return count + (column ? 1 : 0);
      }, 0);

  return {
    path: item.relative_path,
    language: languageForPath(item.relative_path),
    query_sha256_prefix: crypto.createHash("sha256").update(needle).digest("hex").slice(0, 16),
    mode,
    case_sensitive: caseSensitive,
    total_lines: lines.length,
    match_count: Math.min(totalMatchesEstimate, maxMatches),
    total_matches_estimate: totalMatchesEstimate,
    truncated: totalMatchesEstimate > maxMatches,
    max_matches: maxMatches,
    include_preview: includePreview,
    matches,
  };
}

async function walkCodeFiles(rootPath, { recursive = true, maxFiles = 500 } = {}) {
  const root = resolveWorkspacePath(rootPath || ".");
  const stat = await fsp.stat(root.absolute_path);
  const files = [];
  let visited = 0;
  let truncated = false;

  async function walk(dirAbs) {
    if (truncated) return;
    const entries = await fsp.readdir(dirAbs, { withFileTypes: true });
    for (const entry of entries) {
      if (truncated) return;
      if (DENY_DIRS.has(entry.name)) continue;
      const abs = path.join(dirAbs, entry.name);
      const rel = path.relative(WORKSPACE_ROOT, abs).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
        if (recursive) await walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!CODE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      visited += 1;
      if (visited > maxFiles) { truncated = true; return; }
      files.push(rel);
    }
  }

  if (stat.isFile()) {
    if (CODE_EXTENSIONS.has(path.extname(root.relative_path).toLowerCase())) files.push(root.relative_path);
    visited = files.length;
  } else if (stat.isDirectory()) {
    await walk(root.absolute_path);
  } else {
    throw new Error("Path is neither file nor directory.");
  }

  return { root: root.relative_path, files, visited, truncated };
}

function localImportCandidates(fileRel, language, source) {
  const dir = path.posix.dirname(fileRel);
  const clean = toPosix(source);
  const out = [];
  if (language === "javascript") {
    if (!clean.startsWith(".")) return out;
    const base = path.posix.normalize(path.posix.join(dir, clean));
    for (const ext of ["", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"]) out.push(base + ext);
    for (const ext of [".js", ".ts", ".tsx", ".jsx"]) out.push(path.posix.join(base, "index" + ext));
  }
  if (language === "python") {
    if (!clean.startsWith(".")) return out;
    const dots = clean.match(/^\.+/)?.[0]?.length || 0;
    const rest = clean.slice(dots).replaceAll(".", "/");
    let baseDir = dir;
    for (let i = 1; i < dots; i += 1) baseDir = path.posix.dirname(baseDir);
    const base = path.posix.normalize(path.posix.join(baseDir, rest));
    out.push(base + ".py");
    out.push(path.posix.join(base, "__init__.py"));
  }
  return out;
}

function resolveCandidate(candidates, existing) {
  for (const candidate of candidates) if (existing.has(candidate)) return candidate;
  return null;
}

async function resolveWorkspaceCandidate(candidates) {
  for (const candidate of candidates) {
    try {
      const resolved = resolveWorkspacePath(candidate, { allowDirectory: false });
      const stat = await fsp.stat(resolved.absolute_path);
      if (stat.isFile() && CODE_EXTENSIONS.has(path.extname(resolved.relative_path).toLowerCase())) {
        return resolved.relative_path;
      }
    } catch {}
  }
  return null;
}

async function buildDependencyGraph(rootPath, { recursive = true, maxFiles = 500 } = {}) {
  const scan = await walkCodeFiles(rootPath, { recursive, maxFiles: Math.min(maxFiles, MAX_GRAPH_FILES) });
  const existing = new Set(scan.files);
  const nodes = [];
  const edges = [];
  const externalWorkspaceEdges = [];
  const unresolved = [];

  for (const rel of scan.files) {
    const item = await statCodeFile(rel);
    const text = await fsp.readFile(item.absolute_path, "utf8");
    const { language, symbols } = extractSymbols(rel, text);
    const imports = symbols.filter((item) => item.kind === "import");
    nodes.push({ path: rel, language, imports: imports.length, symbols: symbols.length });

    for (const imp of imports) {
      const source = imp.source || imp.name;
      const candidates = localImportCandidates(rel, language, source);
      const resolved = resolveCandidate(candidates, existing);
      if (resolved) {
        edges.push({ from: rel, to: resolved, source, line: imp.line });
      } else if (candidates.length > 0) {
        const externalResolved = await resolveWorkspaceCandidate(candidates);
        if (externalResolved) {
          externalWorkspaceEdges.push({ from: rel, to: externalResolved, source, line: imp.line, scope: "workspace-external" });
        } else {
          unresolved.push({ from: rel, source, line: imp.line, candidates: candidates.slice(0, 5) });
        }
      }
      if (edges.length + externalWorkspaceEdges.length >= MAX_GRAPH_EDGES) break;
    }
  }

  return {
    path: scan.root,
    recursive,
    max_files: maxFiles,
    visited_files: scan.visited,
    scanned_files: scan.files.length,
    truncated: scan.truncated || edges.length + externalWorkspaceEdges.length >= MAX_GRAPH_EDGES,
    nodes_count: nodes.length,
    edges_count: edges.length,
    external_workspace_edges_count: externalWorkspaceEdges.length,
    unresolved_count: unresolved.length,
    nodes,
    edges: edges.slice(0, MAX_GRAPH_EDGES),
    external_workspace_edges: externalWorkspaceEdges.slice(0, MAX_GRAPH_EDGES),
    unresolved: unresolved.slice(0, MAX_GRAPH_EDGES),
  };
}

function auditGraph(graph, topN = 20) {
  const inDegree = new Map();
  const outDegree = new Map();
  for (const node of graph.nodes) {
    inDegree.set(node.path, 0);
    outDegree.set(node.path, 0);
  }
  for (const edge of graph.edges) {
    outDegree.set(edge.from, (outDegree.get(edge.from) || 0) + 1);
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }
  for (const edge of graph.external_workspace_edges || []) {
    outDegree.set(edge.from, (outDegree.get(edge.from) || 0) + 1);
  }
  const sortDesc = (map) => [...map.entries()]
    .map(([filePath, degree]) => ({ path: filePath, degree }))
    .sort((a, b) => b.degree - a.degree || a.path.localeCompare(b.path))
    .slice(0, topN);
  return {
    path: graph.path,
    recursive: graph.recursive,
    max_files: graph.max_files,
    summary: {
      nodes: graph.nodes_count,
      edges: graph.edges_count,
      external_workspace_edges: graph.external_workspace_edges_count || 0,
      unresolved: graph.unresolved_count,
      truncated: graph.truncated,
    },
    high_fan_in: sortDesc(inDegree),
    high_fan_out: sortDesc(outDegree),
    external_workspace_edges: (graph.external_workspace_edges || []).slice(0, topN),
    unresolved: graph.unresolved.slice(0, topN),
  };
}

function resolveImpactTarget(graph, target) {
  const raw = toPosix(target).replace(/^\.\//, "");
  const nodeSet = new Set(graph.nodes.map((node) => node.path));
  const attempted = [];

  function add(candidate, reason) {
    const normalized = toPosix(candidate).replace(/^\.\//, "");
    if (!normalized || attempted.some((item) => item.target === normalized)) return;
    attempted.push({ target: normalized, reason, found: nodeSet.has(normalized) });
  }

  add(raw, "as_provided_workspace_relative");

  const scope = toPosix(graph.path || "").replace(/^\.\//, "");
  if (scope && scope !== "." && !raw.startsWith(`${scope}/`)) {
    add(path.posix.normalize(path.posix.join(scope, raw)), "relative_to_scan_scope");
  }

  const basenameMatches = graph.nodes
    .map((node) => node.path)
    .filter((nodePath) => path.posix.basename(nodePath) === path.posix.basename(raw));
  if (basenameMatches.length === 1) {
    add(basenameMatches[0], "unique_basename_match");
  }

  const match = attempted.find((item) => item.found);
  if (match) {
    return {
      start: match.target,
      found: true,
      resolution: match.reason,
      attempted_targets: attempted,
      target_not_found_reason: "",
      suggested_targets: [],
    };
  }

  const suggestedTargets = basenameMatches.slice(0, 10);
  const targetExistsInGraphScope = basenameMatches.length > 0;
  const targetNotFoundReason = graph.truncated
    ? "target_may_be_outside_truncated_graph"
    : targetExistsInGraphScope
      ? "target_ambiguous_basename_match"
      : "target_not_in_scanned_graph";

  return {
    start: raw,
    found: false,
    resolution: "not_found",
    attempted_targets: attempted,
    target_not_found_reason: targetNotFoundReason,
    suggested_targets: suggestedTargets,
  };
}

function impactGraph(graph, target, direction = "both", maxDepth = 5) {
  const resolvedTarget = resolveImpactTarget(graph, target);
  const start = resolvedTarget.start;
  const nodeSet = new Set(graph.nodes.map((node) => node.path));
  const forward = new Map();
  const reverse = new Map();
  for (const node of graph.nodes) {
    forward.set(node.path, []);
    reverse.set(node.path, []);
  }
  for (const edge of graph.edges) {
    forward.get(edge.from)?.push({ path: edge.to, via: edge.source, line: edge.line, scope: "internal" });
    reverse.get(edge.to)?.push({ path: edge.from, via: edge.source, line: edge.line, scope: "internal" });
  }
  for (const edge of graph.external_workspace_edges || []) {
    forward.get(edge.from)?.push({ path: edge.to, via: edge.source, line: edge.line, scope: "workspace-external" });
  }
  if (!nodeSet.has(start)) {
    return {
      target: start,
      requested_target: toPosix(target),
      found: false,
      resolution: resolvedTarget.resolution,
      target_not_found_reason: resolvedTarget.target_not_found_reason,
      attempted_targets: resolvedTarget.attempted_targets,
      suggested_targets: resolvedTarget.suggested_targets,
      scope_path: graph.path,
      maybe_truncated_graph: Boolean(graph.truncated),
      affected_count: 0,
      dependencies_count: 0,
      affected: [],
      dependencies: [],
    };
  }
  function traverse(map) {
    const seen = new Set([start]);
    const out = [];
    const queue = [{ path: start, depth: 0 }];
    while (queue.length) {
      const cur = queue.shift();
      if (cur.depth >= maxDepth) continue;
      for (const next of map.get(cur.path) || []) {
        if (seen.has(next.path)) continue;
        seen.add(next.path);
        const item = { path: next.path, depth: cur.depth + 1, via: next.via, line: next.line, scope: next.scope || "internal" };
        out.push(item);
        queue.push(item);
      }
    }
    return out;
  }
  const affected = direction === "dependencies" ? [] : traverse(reverse);
  const dependencies = direction === "dependents" ? [] : traverse(forward);
  return {
    target: start,
    requested_target: toPosix(target),
    found: true,
    resolution: resolvedTarget.resolution,
    attempted_targets: resolvedTarget.attempted_targets,
    affected_count: affected.length,
    dependencies_count: dependencies.length,
    affected,
    dependencies,
  };
}

function runBoundedProcess(command, args, { timeoutMs = 6000, cwd = WORKSPACE_ROOT } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout.on("data", (data) => { stdout += String(data).slice(0, 20000); });
    child.stderr.on("data", (data) => { stderr += String(data).slice(0, 20000); });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, exit_code: null, timed_out: timedOut, duration_ms: Date.now() - started, stdout, stderr: stderr || error.message });
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0 && !timedOut, exit_code: code, timed_out: timedOut, duration_ms: Date.now() - started, stdout, stderr });
    });
  });
}

async function syntaxCheck(filePath) {
  const item = await statCodeFile(filePath);
  const ext = path.extname(item.relative_path).toLowerCase();
  if (JS_CHECK_EXTENSIONS.has(ext)) {
    const result = await runBoundedProcess(process.execPath, ["--check", item.absolute_path]);
    return { path: item.relative_path, language: "javascript", checker: "node --check", ...result };
  }
  if (PY_CHECK_EXTENSIONS.has(ext)) {
    const py = process.env.MCP_TEST_PYTHON_BIN || "python";
    const result = await runBoundedProcess(py, ["-m", "py_compile", item.absolute_path]);
    return { path: item.relative_path, language: "python", checker: "python -m py_compile", ...result };
  }
  return {
    path: item.relative_path,
    language: languageForPath(item.relative_path),
    checker: "none",
    ok: false,
    exit_code: null,
    timed_out: false,
    duration_ms: 0,
    stdout: "",
    stderr: "No syntax checker configured for this file extension.",
  };
}

module.exports = {
  CODE_EXTENSIONS,
  MAX_CODE_FILE_BYTES,
  MAX_GRAPH_EDGES,
  MAX_GRAPH_FILES,
  MAX_SYMBOLS,
  auditGraph,
  buildDependencyGraph,
  codeSymbols,
  extractSymbols,
  impactGraph,
  locateCode,
  languageForPath,
  linesOf,
  normalizeWorkspacePath,
  resolveWorkspacePath,
  syntaxCheck,
};
