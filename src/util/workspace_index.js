"use strict";

const crypto = require("node:crypto");
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
const FRESHNESS_SAMPLE_LIMIT = 20;
const QUERY_STOPWORDS = new Set([
  "a", "an", "and", "are", "be", "does", "for", "how", "in", "is", "it", "of", "or", "the", "to", "what", "which", "with",
  "a", "albo", "czy", "dla", "do", "i", "jak", "jest", "ktory", "ktora", "ktore", "na", "oraz", "to", "w", "z",
]);
const EVIDENCE_QUERY_TERMS = new Set(["audit", "dowod", "dowody", "evidence", "proof", "prove", "proved", "proves", "raport", "report", "validation"]);
const READINESS_QUERY_TERMS = new Set([
  "component", "components", "dojrzalosc", "gotowosc", "maturities", "maturity", "readiness", "skladnik", "skladniki",
]);
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

function queryTokenList(text) {
  return tokenList(text).filter((item) => !QUERY_STOPWORDS.has(item));
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

function hasAnyTerm(terms, wanted) {
  return terms.some((term) => wanted.has(term));
}

function activeWorkflowIntentScore(doc, terms) {
  const planningTerms = new Set([
    "active", "action", "blocked", "blocker", "blockers", "current", "default", "dependency", "next",
    "p0", "p1", "package", "priority", "queue", "recommended", "roadmap", "readiness", "workflow",
    "blokada", "blokady", "dalej", "dlaczego", "kolejka", "kolejke", "nastepne", "nastepny",
    "priorytet", "zablokowany",
  ]);
  if (!hasAnyTerm(terms, planningTerms)) return 0;

  const normalizedPath = normalizeSlashes(doc?.path || "").toLowerCase();
  if (!normalizedPath.includes("/_workflow/") && !normalizedPath.startsWith("_workflow/")) return 0;

  const base = path.posix.basename(normalizedPath);
  if (base === "active_workflow_index.md") return 210;
  if (base === "readiness.md") return 170;
  if (base === "roadmap.md") return 130;
  if (base === "state.json") return 90;
  if (base === "state.md") return 80;
  if (base === "workflow_canon.md") return 70;
  if (base === "northstar.md") return 45;
  if (String(doc?.kind || "") === "operator_decision") return -25;
  return 0;
}

function readinessIntentScore(doc, terms) {
  if (!hasAnyTerm(terms, READINESS_QUERY_TERMS)) return 0;
  const base = path.posix.basename(normalizeSlashes(doc?.path || "").toLowerCase());
  if (base === "readiness.md") return 180;
  if (base === "roadmap.md") return 50;
  if (base === "state.md" || base === "state.json") return 25;
  return 0;
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

function retrievalMetadata(index = {}, pathFilter = ".", freshness = emptyFreshness()) {
  return {
    index_scope: resolveIndexScope(index),
    path_filter: normalizeOutputPathFilter(pathFilter),
    index_profile: normalizeIndexProfile(index.profile || index.stats?.profile),
    index_truncated: Boolean(index.stats?.truncated),
    index_created_at: String(index.created_at || ""),
    index_count: Array.isArray(index.docs) ? index.docs.length : 0,
    freshness,
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
    freshness: emptyFreshness("unknown", "index_unavailable"),
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

function docPathEndsWith(doc, suffix) {
  return normalizeSlashes(doc?.path || "").toLowerCase().endsWith(normalizeSlashes(suffix).toLowerCase());
}

function findDocBySuffix(docs, suffix) {
  return docs.find((doc) => docPathEndsWith(doc, suffix));
}

function repoPrefixForPath(displayPath = "") {
  const normalized = normalizeSlashes(displayPath);
  const parts = normalized.split("/").filter(Boolean);
  return parts.length > 0 ? parts[0] : "";
}

function normalizeDocReferenceTarget(sourcePath = "", rawTarget = "") {
  let target = normalizeSlashes(String(rawTarget || "").trim());
  if (!target) return "";
  target = target.replace(/^<|>$/g, "");
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return "";
  target = target.split("#")[0].split("?")[0].trim();
  if (!target) return "";
  if (/[*{},]/.test(target)) return "";

  const source = normalizeSlashes(sourcePath);
  const sourcePrefix = repoPrefixForPath(source);
  const sourceDir = path.posix.dirname(source);
  const rootLike = /^(?:_workflow|_tests|docs|src|tools|scripts|profiles|plugins|docker|\.agents)\//.test(target)
    || /^SERVER_[A-Z0-9_]+_SPEC\.json$/i.test(target)
    || /^(?:README|DIRECTORY|GITHUB_PUBLISHING|package(?:-lock)?)\.(?:md|json)$/i.test(target);

  if (target.startsWith("./") || target.startsWith("../")) {
    return path.posix.normalize(path.posix.join(sourceDir, target));
  }
  if (target.startsWith("/")) {
    return sourcePrefix ? `${sourcePrefix}${target}` : target.replace(/^\/+/, "");
  }
  if (rootLike && sourcePrefix) {
    return path.posix.normalize(`${sourcePrefix}/${target}`);
  }
  return path.posix.normalize(path.posix.join(sourceDir, target));
}

function extractDocumentReferences(doc) {
  const sample = String(doc?.sample || "");
  const refs = new Set();
  for (const match of sample.matchAll(/\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = normalizeDocReferenceTarget(doc.path, match[1]);
    if (target) refs.add(target);
  }
  for (const match of sample.matchAll(/`([^`]+\.(?:md|json|ya?ml|toml|txt))`/gi)) {
    const target = normalizeDocReferenceTarget(doc.path, match[1]);
    if (target) refs.add(target);
  }
  return [...refs].sort();
}

function buildDocumentGraphSummary(docs) {
  const docPaths = new Map(docs.map((doc) => [normalizeSlashes(doc.path || "").toLowerCase(), doc]));
  const uniqueBasenames = new Map();
  const duplicateBasenames = new Set();
  for (const doc of docs) {
    const docPath = normalizeSlashes(doc.path || "");
    const base = path.posix.basename(docPath).toLowerCase();
    if (!base) continue;
    if (uniqueBasenames.has(base)) {
      duplicateBasenames.add(base);
      continue;
    }
    uniqueBasenames.set(base, docPath);
  }
  for (const base of duplicateBasenames) uniqueBasenames.delete(base);
  const outgoingByPath = new Map();
  const incomingCounts = new Map();
  const unresolved = [];
  let internalLinkCount = 0;

  for (const doc of docs) {
    const source = normalizeSlashes(doc.path || "");
    const links = [];
    for (const target of extractDocumentReferences(doc)) {
      let resolvedTarget = target;
      let key = resolvedTarget.toLowerCase();
      if (!docPaths.has(key)) {
        const basenameMatch = uniqueBasenames.get(path.posix.basename(resolvedTarget).toLowerCase());
        if (basenameMatch) {
          resolvedTarget = basenameMatch;
          key = resolvedTarget.toLowerCase();
        }
      }
      if (docPaths.has(key)) {
        links.push(resolvedTarget);
        internalLinkCount += 1;
        incomingCounts.set(resolvedTarget, (incomingCounts.get(resolvedTarget) || 0) + 1);
      } else {
        unresolved.push({ source, target: resolvedTarget });
      }
    }
    if (links.length > 0) outgoingByPath.set(source, links);
  }

  const topLinkedDocs = [...incomingCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([docPath, incoming_count]) => {
      const doc = docPaths.get(docPath.toLowerCase()) || {};
      return {
        path: docPath,
        title: String(doc.title || ""),
        kind: String(doc.kind || "document"),
        authority: String(doc.authority || "supporting"),
        incoming_count,
      };
    });

  const activeEntrypointLinks = [
    "mcp-tests/_workflow/ACTIVE_WORKFLOW_INDEX.md",
    "mcp-tests/_workflow/READINESS.md",
    "mcp-tests/_workflow/ROADMAP.md",
    "_workflow/ACTIVE_WORKFLOW_INDEX.md",
    "_workflow/READINESS.md",
    "_workflow/ROADMAP.md",
  ]
    .filter((item, index, items) => items.indexOf(item) === index)
    .map((docPath) => ({
      path: docPath,
      outgoing: (outgoingByPath.get(docPath) || []).slice(0, 20),
    }))
    .filter((item) => item.outgoing.length > 0);

  const sourceOfTruthPaths = docs
    .filter((doc) => doc.authority === "source_of_truth")
    .map((doc) => normalizeSlashes(doc.path || ""))
    .sort();
  const linkedSourceOfTruth = sourceOfTruthPaths.filter((docPath) => {
    if ((incomingCounts.get(docPath) || 0) > 0) return true;
    return (outgoingByPath.get(docPath) || []).length > 0;
  });

  return {
    node_count: docs.length,
    linked_node_count: new Set([...outgoingByPath.keys(), ...incomingCounts.keys()]).size,
    internal_link_count: internalLinkCount,
    unresolved_reference_count: unresolved.length,
    source_of_truth_linked_count: linkedSourceOfTruth.length,
    source_of_truth_total_count: sourceOfTruthPaths.length,
    top_linked_docs: topLinkedDocs,
    active_entrypoint_links: activeEntrypointLinks,
    unresolved_references_sample: unresolved
      .sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target))
      .slice(0, 20),
  };
}

function safeJsonParse(text) {
  try {
    const parsed = JSON.parse(String(text || ""));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function extractJsonValueByKey(text, key) {
  const source = String(text || "");
  const keyMatch = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:\\s*`).exec(source);
  if (!keyMatch) return undefined;
  const start = keyMatch.index + keyMatch[0].length;
  const opening = source[start];
  const closing = opening === "{" ? "}" : opening === "[" ? "]" : "";
  if (!closing) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === opening) depth += 1;
    if (char === closing) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  return undefined;
}

function parseWorkflowStateSample(text) {
  const parsed = safeJsonParse(text);
  if (Object.keys(parsed).length > 0) return parsed;
  const state = {};
  for (const key of ["server_identity", "runtime_topology", "tool_surfaces", "workflow_progress_markers"]) {
    const valueText = extractJsonValueByKey(text, key);
    const value = safeJsonParse(valueText);
    if (Object.keys(value).length > 0) state[key] = value;
  }
  return state;
}

function cleanMarkdownCell(value) {
  return String(value || "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function splitMarkdownTableLine(line) {
  const source = String(line || "").trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let cell = "";
  let escaped = false;
  let inCode = false;
  for (const char of source) {
    if (escaped) {
      cell += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      cell += char;
      escaped = true;
      continue;
    }
    if (char === "`") {
      inCode = !inCode;
      cell += char;
      continue;
    }
    if (char === "|" && !inCode) {
      cells.push(cleanMarkdownCell(cell));
      cell = "";
      continue;
    }
    cell += char;
  }
  cells.push(cleanMarkdownCell(cell));
  return cells;
}

function parseMarkdownTable(text, wantedHeaders = []) {
  const rows = [];
  const lines = String(text || "").split(/\r?\n/);
  for (let index = 0; index < lines.length - 1; index += 1) {
    const headerLine = lines[index];
    const separatorLine = lines[index + 1];
    if (!headerLine.trim().startsWith("|") || !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(separatorLine)) {
      continue;
    }
    const headers = splitMarkdownTableLine(headerLine).map((item) => item.toLowerCase());
    if (wantedHeaders.length > 0 && !wantedHeaders.every((wanted) => headers.includes(wanted))) {
      continue;
    }
    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const line = lines[rowIndex];
      if (!line.trim().startsWith("|")) break;
      const cells = splitMarkdownTableLine(line);
      const row = {};
      headers.forEach((header, cellIndex) => {
        row[header] = cells[cellIndex] || "";
      });
      rows.push(row);
    }
    break;
  }
  return rows;
}

function extractStatusLine(text) {
  const match = String(text || "").match(/^Status:\s*(.+)$/mi);
  return match ? cleanMarkdownCell(match[1]) : "";
}

function extractUpdatedLine(text) {
  const match = String(text || "").match(/^Updated:\s*(.+)$/mi);
  return match ? cleanMarkdownCell(match[1]) : "";
}

function parseReadinessComponents(doc) {
  const rows = parseMarkdownTable(doc?.sample, ["id", "component", "maturity"]).slice(0, 20);
  return rows.map((row) => ({
    id: row.id || "",
    component: row.component || "",
    maturity: row.maturity || "",
    northstar_role: row["northstar role"] || "",
    depends_on: row["depends on"] || "",
    current_evidence: row["current evidence"] || "",
    main_blocker: row["main blocker"] || "",
    default_next_package: row["default next bounded package"] || "",
    done_signal: row["done signal"] || "",
  }));
}

function parseRoadmapItems(doc) {
  const rows = parseMarkdownTable(doc?.sample, ["priority", "item", "current action"]).slice(0, 20);
  return rows.map((row) => ({
    priority: row.priority || "",
    item: row.item || "",
    depends_on: row["depends on"] || "",
    why_now: row["why it matters now"] || "",
    current_action: row["current action"] || "",
  }));
}

function canonicalDocEntry(id, docs, suffix) {
  const doc = findDocBySuffix(docs, suffix);
  return {
    id,
    path: doc ? String(doc.path || "") : suffix,
    present: Boolean(doc),
    kind: String(doc?.kind || ""),
    authority: String(doc?.authority || ""),
    modified: String(doc?.modified || ""),
  };
}

function buildWorkflowKnowledgeSummary(docs) {
  const northstarDoc = findDocBySuffix(docs, "_workflow/NORTHSTAR.md");
  const stateDoc = findDocBySuffix(docs, "_workflow/STATE.md");
  const stateJsonDoc = findDocBySuffix(docs, "_workflow/state.json");
  const readinessDoc = findDocBySuffix(docs, "_workflow/READINESS.md");
  const roadmapDoc = findDocBySuffix(docs, "_workflow/ROADMAP.md");
  const workflowCanonDoc = findDocBySuffix(docs, "_workflow/WORKFLOW_CANON.md");
  const activeIndexDoc = findDocBySuffix(docs, "_workflow/ACTIVE_WORKFLOW_INDEX.md");
  const state = parseWorkflowStateSample(stateJsonDoc?.sample);
  const serverIdentity = state.server_identity || {};
  const runtimeTopology = state.runtime_topology || {};
  const toolSurfaces = state.tool_surfaces || {};
  const progressMarkers = state.workflow_progress_markers || {};
  const canonicalDocs = [
    canonicalDocEntry("northstar", docs, "_workflow/NORTHSTAR.md"),
    canonicalDocEntry("state", docs, "_workflow/STATE.md"),
    canonicalDocEntry("state_json", docs, "_workflow/state.json"),
    canonicalDocEntry("readiness", docs, "_workflow/READINESS.md"),
    canonicalDocEntry("roadmap", docs, "_workflow/ROADMAP.md"),
    canonicalDocEntry("workflow_canon", docs, "_workflow/WORKFLOW_CANON.md"),
    canonicalDocEntry("active_workflow_index", docs, "_workflow/ACTIVE_WORKFLOW_INDEX.md"),
  ];
  const serverSpecs = docs
    .filter((doc) => doc.kind === "server_spec")
    .map((doc) => String(doc.path || ""))
    .sort();
  const readinessComponents = parseReadinessComponents(readinessDoc);
  const roadmapItems = parseRoadmapItems(roadmapDoc);
  const documentationGaps = [];
  for (const entry of canonicalDocs) {
    if (!entry.present) {
      documentationGaps.push({
        severity: "high",
        area: entry.id,
        issue: "missing_canonical_doc",
        detail: entry.path,
      });
    }
  }
  if (serverSpecs.length === 0) {
    documentationGaps.push({
      severity: "medium",
      area: "server_specs",
      issue: "missing_server_specs",
      detail: "No SERVER_*_SPEC.json document was indexed.",
    });
  }

  return {
    canonical_docs: canonicalDocs,
    server_specs: {
      count: serverSpecs.length,
      sample_paths: serverSpecs.slice(0, 12),
    },
    workflow_markers: {
      current_working_course: String(progressMarkers.current_working_course || ""),
      next_primary: String(progressMarkers.next_primary || ""),
      next_secondary: String(progressMarkers.next_secondary || ""),
      stage_labels: Array.isArray(progressMarkers.stage_labels) ? progressMarkers.stage_labels.map(String).slice(0, 8) : [],
    },
    runtime_identity: {
      server_name: String(serverIdentity.name || ""),
      server_version: String(serverIdentity.version || ""),
      connector_shape_version: String(serverIdentity.connector_shape_version || ""),
      output_mode: String(serverIdentity.output_mode || ""),
      public_port: Number(runtimeTopology.public?.port || 0),
      authorized_port: Number(runtimeTopology.authorized?.port || 0),
      public_tool_count: Number(toolSurfaces.public_mcp_tools?.count || runtimeTopology.public?.expected_tool_count || 0),
      authorized_tool_count: Number(toolSurfaces.authorized_mcp_tools?.count || 0),
      authenticated_total_tool_count: Number(toolSurfaces.authenticated_total?.count || runtimeTopology.authorized?.expected_tool_count || 0),
    },
    readiness: {
      status: extractStatusLine(readinessDoc?.sample),
      updated: extractUpdatedLine(readinessDoc?.sample),
      component_count: readinessComponents.length,
      components: readinessComponents,
    },
    roadmap: {
      status: extractStatusLine(roadmapDoc?.sample),
      updated: extractUpdatedLine(roadmapDoc?.sample),
      item_count: roadmapItems.length,
      items: roadmapItems,
    },
    documentation_gaps: documentationGaps,
    health: {
      has_northstar: Boolean(northstarDoc),
      has_state: Boolean(stateDoc && stateJsonDoc),
      has_readiness: Boolean(readinessDoc),
      has_roadmap: Boolean(roadmapDoc),
      has_workflow_canon: Boolean(workflowCanonDoc && activeIndexDoc),
      has_runtime_identity: Boolean(serverIdentity.name && serverIdentity.version),
      source_of_truth_count: docs.filter((doc) => doc.authority === "source_of_truth").length,
    },
  };
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
    workflow_summary: buildWorkflowKnowledgeSummary(docs),
    document_graph: buildDocumentGraphSummary(docs),
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

function boundedHeadTailText(text, maxChars = MAX_INDEX_TEXT_CHARS) {
  const source = String(text || "");
  if (source.length <= maxChars) return source;
  const separator = "\n...[bounded middle omitted]...\n";
  const remaining = Math.max(0, maxChars - separator.length);
  const headChars = Math.ceil(remaining / 2);
  const tailChars = Math.floor(remaining / 2);
  return source.slice(0, headChars) + separator + source.slice(-tailChars);
}

async function loadWorkspaceIndex(options = {}) {
  const indexFile = getIndexFile(options);
  return JSON.parse(await fsp.readFile(indexFile, "utf8"));
}

function canonicalWorkflowSampleRequired(classification, displayPath) {
  const base = path.posix.basename(normalizeSlashes(displayPath).toLowerCase());
  return classification.authority === "source_of_truth" && new Set([
    "active_workflow_index.md",
    "northstar.md",
    "readiness.md",
    "roadmap.md",
    "state.json",
    "state.md",
    "workflow_canon.md",
  ]).has(base);
}

function resolveIndexedDisplayPath(index, displayPath) {
  const roots = Array.isArray(index?.roots) ? index.roots : [];
  const normalized = normalizeSlashes(displayPath);
  let root;
  let relativePath = normalized;
  if (normalized.startsWith("@")) {
    const slash = normalized.indexOf("/");
    const alias = slash >= 0 ? normalized.slice(1, slash) : normalized.slice(1);
    root = roots.find((item) => String(item.alias || "") === alias);
    relativePath = slash >= 0 ? normalized.slice(slash + 1) : ".";
  } else {
    root = roots.find((item) => item.primary) || roots[0];
  }
  if (!root?.path) return "";
  return path.resolve(String(root.path), relativePath || ".");
}

function emptyFreshness(status = "unknown", reason = "snapshot_unavailable_rebuild_required") {
  return {
    status,
    stale: status !== "fresh",
    checked_at: new Date().toISOString(),
    coverage: "indexed_files_and_visited_directories",
    changed_file_count: 0,
    missing_file_count: 0,
    changed_directory_count: 0,
    missing_directory_count: 0,
    changed_files: [],
    missing_files: [],
    changed_directories: [],
    missing_directories: [],
    reasons: reason ? [reason] : [],
  };
}

function contentFingerprint(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function directoryEntryFingerprint(entries, excludedNames = []) {
  const excluded = new Set(excludedNames.map(String));
  const rows = entries
    .filter((entry) => !excluded.has(entry.name))
    .map((entry) => `${entry.name}\0${entry.isDirectory() ? "d" : entry.isFile() ? "f" : entry.isSymbolicLink() ? "l" : "o"}`)
    .sort();
  return contentFingerprint(rows.join("\n"));
}

async function forEachConcurrent(items, concurrency, callback) {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await callback(item);
    }
  }));
}

async function assessIndexFreshness(index = {}) {
  const snapshot = index.stats?.source_snapshot;
  if (!snapshot || !Array.isArray(snapshot.files) || !Array.isArray(snapshot.directories)) {
    return emptyFreshness();
  }

  const changedFiles = [];
  const missingFiles = [];
  const changedDirectories = [];
  const missingDirectories = [];
  await forEachConcurrent(snapshot.files, 32, async (item) => {
    const absolutePath = resolveIndexedDisplayPath(index, item.path);
    try {
      const stat = await fsp.stat(absolutePath);
      if (stat.size !== Number(item.bytes)) {
        changedFiles.push(item.path);
        return;
      }
      if (Math.abs(stat.mtimeMs - Number(item.mtime_ms)) <= 1) return;
      if (!item.content_hash) {
        changedFiles.push(item.path);
        return;
      }
      const maxChars = item.hash_mode === "canonical_full" ? MAX_INDEX_FILE_BYTES : MAX_INDEX_TEXT_CHARS;
      const currentText = await readTextPrefixStream(absolutePath, maxChars);
      if (contentFingerprint(currentText) !== item.content_hash) changedFiles.push(item.path);
    } catch (error) {
      if (error?.code === "ENOENT") missingFiles.push(item.path);
      else changedFiles.push(item.path);
    }
  });
  await forEachConcurrent(snapshot.directories, 32, async (item) => {
    const absolutePath = resolveIndexedDisplayPath(index, item.path);
    try {
      const stat = await fsp.stat(absolutePath);
      if (Math.abs(stat.mtimeMs - Number(item.mtime_ms)) <= 1) return;
      if (!item.entry_hash) {
        changedDirectories.push(item.path);
        return;
      }
      const entries = await fsp.readdir(absolutePath, { withFileTypes: true });
      if (directoryEntryFingerprint(entries, item.excluded_names) !== item.entry_hash) changedDirectories.push(item.path);
    } catch (error) {
      if (error?.code === "ENOENT") missingDirectories.push(item.path);
      else changedDirectories.push(item.path);
    }
  });

  const stale = changedFiles.length > 0 || missingFiles.length > 0 || changedDirectories.length > 0 || missingDirectories.length > 0;
  return {
    status: stale ? "stale" : "fresh",
    stale,
    checked_at: new Date().toISOString(),
    coverage: "indexed_files_and_visited_directories",
    changed_file_count: changedFiles.length,
    missing_file_count: missingFiles.length,
    changed_directory_count: changedDirectories.length,
    missing_directory_count: missingDirectories.length,
    changed_files: changedFiles.slice(0, FRESHNESS_SAMPLE_LIMIT),
    missing_files: missingFiles.slice(0, FRESHNESS_SAMPLE_LIMIT),
    changed_directories: changedDirectories.slice(0, FRESHNESS_SAMPLE_LIMIT),
    missing_directories: missingDirectories.slice(0, FRESHNESS_SAMPLE_LIMIT),
    reasons: stale ? ["indexed_workspace_changed_after_build"] : [],
  };
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
  const canonicalSamples = new Map();
  const fileSnapshots = [];
  const directorySnapshots = [];
  const skipped = { oversized: 0, extension: 0, directories: 0 };
  let visitedFiles = 0;
  let visitedDirs = 0;
  let truncated = false;

  async function addFileToIndex(root, full) {
    if (path.resolve(full) === path.resolve(indexFile)) return;
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
    let sample = text;
    let freshnessText = text;
    let hashMode = "retrieval_prefix";
    if (profile === "knowledge" && canonicalWorkflowSampleRequired(classification, displayPath) && stat.size > text.length) {
      const canonicalText = await readTextPrefixStream(full, MAX_INDEX_FILE_BYTES);
      canonicalSamples.set(displayPath, canonicalText);
      sample = boundedHeadTailText(canonicalText);
      freshnessText = canonicalText;
      hashMode = "canonical_full";
    }
    docs.push({
      path: displayPath,
      title: classification.title,
      kind: classification.kind,
      authority: classification.authority,
      format: classification.format,
      sample,
      bytes: stat.size,
      modified: stat.mtime.toISOString(),
    });
    fileSnapshots.push({
      path: displayPath,
      bytes: stat.size,
      mtime_ms: stat.mtimeMs,
      hash_mode: hashMode,
      content_hash: contentFingerprint(freshnessText),
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
    const excludedNames = path.resolve(path.dirname(indexFile)) === path.resolve(dir)
      ? [path.basename(indexFile)]
      : [];
    const dirStat = await fsp.stat(dir);
    directorySnapshots.push({
      path: displayPathForRoot(root, dir),
      mtime_ms: dirStat.mtimeMs,
      entry_hash: directoryEntryFingerprint(entries, excludedNames),
      excluded_names: excludedNames,
    });
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

  const summaryDocs = docs.map((doc) => canonicalSamples.has(doc.path) ? { ...doc, sample: canonicalSamples.get(doc.path) } : doc);
  const index = {
    version: 3,
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
      source_snapshot: {
        files: fileSnapshots,
        directories: directorySnapshots,
      },
      knowledge_summary: summarizeIndexKnowledge({ docs: summaryDocs, profile }),
    },
  };

  await fsp.writeFile(indexFile, JSON.stringify(index, null, 2));
  return index;
}

function compactIdentifier(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function identifierAndEvidenceIntentScore(doc, terms) {
  const identifiers = terms.filter((term) => /^[a-z][a-z0-9]*-\d+[a-z0-9-]*$/i.test(term));
  const { stem, segments } = basenameInfo(doc.path);
  const title = normalizeQuery(doc.title);
  const sample = normalizeQuery(doc.sample);
  let score = 0;
  for (const identifier of identifiers) {
    const compact = compactIdentifier(identifier);
    const compactStem = compactIdentifier(stem);
    const compactSegments = segments.map(compactIdentifier);
    if (compactStem.startsWith(compact)) score += 180;
    else if (compactSegments.some((segment) => segment === compact || segment.startsWith(compact))) score += 120;
    if (title.includes(identifier)) score += 35;
    if (sample.includes(identifier)) score += 20;
  }
  if (hasAnyTerm(terms, EVIDENCE_QUERY_TERMS)) {
    const evidenceSurface = `${normalizeQuery(doc.path)} ${title}`;
    if (/\bproof\b/.test(evidenceSurface)) score += 100;
    else if (/\bevidence\b/.test(evidenceSurface)) score += 70;
    else if (/\bvalidation\b/.test(evidenceSurface)) score += 55;
    else if (/\b(audit|report)\b/.test(evidenceSurface)) score += 35;
    if (/^status:\s*(complete|completed|done)\b/mi.test(String(doc.sample || ""))) score += 35;
  }
  return score;
}

function scoreDoc(doc, query) {
  const q = normalizeQuery(query);
  const terms = queryTokenList(query);
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
  score += activeWorkflowIntentScore(doc, terms);
  score += readinessIntentScore(doc, terms);
  score += identifierAndEvidenceIntentScore(doc, terms);
  if (p.startsWith("romionsim/")) score += 8;
  if (p.includes("readme")) score += 4;
  if (p.startsWith("mcp-tests/src/")) score += 2;
  return score;
}

function buildSnippet(doc, query, maxLen = 700) {
  const sample = String(doc.sample || "");
  const lower = normalizeQuery(sample);
  const terms = queryTokenList(query);
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
    const knowledgeSummary = stats.knowledge_summary?.workflow_summary ? stats.knowledge_summary : summarizeIndexKnowledge(index);
    const freshness = await assessIndexFreshness(index);
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
      knowledge_summary: knowledgeSummary,
      freshness,
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
        freshness: emptyFreshness("unknown", "index_read_failed"),
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
      freshness: emptyFreshness("unknown", "index_missing"),
      skipped: { oversized: 0, extension: 0, directories: 0 },
    };
  }
}

async function searchIndex(query, { limit = 10, indexFile, path } = {}) {
  const index = await loadWorkspaceIndex({ indexFile });
  const pathFilter = path || ".";
  const freshness = await assessIndexFreshness(index);
  return {
    success: true,
    error: "",
    status: "ok",
    query: String(query || ""),
    ...retrievalMetadata(index, pathFilter, freshness),
    results: rankDocs(index, query, { limit, pathFilter }),
  };
}

async function searchIndexContext(query, { limit = 5, indexFile, path } = {}) {
  const index = await loadWorkspaceIndex({ indexFile });
  const pathFilter = path || ".";
  const freshness = await assessIndexFreshness(index);
  return {
    success: true,
    error: "",
    status: "ok",
    query: String(query || ""),
    ...retrievalMetadata(index, pathFilter, freshness),
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
  const freshness = await assessIndexFreshness(index);
  const byPath = new Map((index.docs || []).map((doc) => [doc.path, doc]));
  return {
    success: true,
    error: "",
    status: "ok",
    query: String(query || ""),
    ...retrievalMetadata(index, pathFilter, freshness),
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
  const freshness = await assessIndexFreshness(index);
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
    ...retrievalMetadata(index, pathFilter, freshness),
    count: files.length,
    files,
  };
}

module.exports = {
  DEFAULT_INDEX_FILE,
  assessIndexFreshness,
  buildWorkspaceIndex,
  collectContext,
  collectRomionsimContext,
  emptyFreshness,
  indexStatus,
  loadWorkspaceIndex,
  retrievalErrorMetadata,
  searchIndex,
  searchIndexContext,
};
