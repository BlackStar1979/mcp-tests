"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_CORPUS_ROOT = path.join(ROOT, "_repos_with_code_samples");

const DEFAULT_REPOSITORIES = [
  {
    id: "codebase-memory-mcp",
    path: "codebase-memory-mcp-main",
    upstream: "https://github.com/DeusData/codebase-memory-mcp",
    role: "structural code memory baseline",
    candidate_ids: ["doc_code_entity_merge", "local_graph_memory", "watcher_as_optional_projection"],
  },
  {
    id: "doctree-mcp",
    path: "joesaby-doctree-mcp",
    upstream: "https://github.com/joesaby/doctree-mcp",
    role: "BM25 plus document tree navigation",
    candidate_ids: ["bounded_tree_navigation"],
  },
  {
    id: "repo-graphrag-mcp",
    path: "yumeiriowl-repo-graphrag-mcp",
    upstream: "https://github.com/yumeiriowl/repo-graphrag-mcp",
    role: "code and docs graph retrieval",
    candidate_ids: ["doc_code_entity_merge", "dependency_cost_gate"],
  },
  {
    id: "docs-mcp-server",
    path: "arabold-docs-mcp-server",
    upstream: "https://github.com/arabold/docs-mcp-server",
    role: "grounded documentation indexing",
    candidate_ids: ["version_grounded_docs", "watcher_as_optional_projection", "dependency_cost_gate"],
  },
  {
    id: "graph-mem-mcp",
    path: "arnokamphuis-graph-mem-mcp",
    upstream: "https://github.com/arnokamphuis/graph-mem-mcp",
    role: "agent memory graph",
    candidate_ids: ["local_graph_memory"],
  },
  {
    id: "obsidian-mcp-server",
    path: "obsidian-mcp-server-master",
    upstream: "https://github.com/cyanheads/obsidian-mcp-server",
    role: "markdown link and vault structure",
    candidate_ids: ["watcher_as_optional_projection"],
  },
  {
    id: "markdown-rag-mcp",
    path: "mohllal-markdown-rag-mcp",
    upstream: "https://github.com/mohllal/markdown-rag-mcp",
    role: "markdown RAG pipeline",
    candidate_ids: ["watcher_as_optional_projection", "dependency_cost_gate"],
  },
];

const IGNORE_DIRS = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  ".venv",
  "venv",
  "__pycache__",
  "dist",
  "build",
  ".next",
  ".cache",
  "target",
  ".mypy_cache",
  ".pytest_cache",
]);

const TEXT_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".go",
  ".h",
  ".hpp",
  ".java",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".mjs",
  ".py",
  ".rs",
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const SIGNALS = {
  retrieval: [
    /\bbm25\b/i,
    /\bfts5?\b/i,
    /full[- ]?text/i,
    /\bsemantic\b/i,
    /\bvector\b/i,
    /\bhybrid\b/i,
    /\brerank/i,
    /\bmmr\b/i,
  ],
  graph: [
    /\bgraph\b/i,
    /\bnode\b/i,
    /\bedge\b/i,
    /\brelation/i,
    /\bcypher\b/i,
    /\bgraphrag\b/i,
    /\blightrag\b/i,
  ],
  parser: [
    /tree[-_ ]?sitter/i,
    /\bAST\b/,
    /\bfrontmatter\b/i,
    /\bmarkdown\b/i,
    /\bmermaid\b/i,
    /\bdocstring\b/i,
    /\bjsdoc\b/i,
  ],
  storage: [
    /\bsqlite\b/i,
    /\bwal\b/i,
    /\blancedb\b/i,
    /\bqdrant\b/i,
    /\bmilvus\b/i,
    /\bchroma\b/i,
    /\bfalkordb\b/i,
    /\bjson\b/i,
  ],
  updates: [
    /\bwatch(er)?\b/i,
    /\bincremental\b/i,
    /\blive update/i,
    /\bdetect_changes\b/i,
    /\brefresh\b/i,
  ],
  mcp: [
    /\bmodel context protocol\b/i,
    /\bMCP\b/,
    /\bregisterTool\b/,
    /\.tool\(/,
    /\btools\/(list|call)\b/i,
  ],
};

const TRANSPLANTS = [
  {
    id: "bounded_tree_navigation",
    signal: "tree navigation, BM25, glossary, row lookup",
    evidence_patterns: [
      /\bbuildTree\b/,
      /\bnavigateTree\b/,
      /\bgetNodeContent\b/,
      /\bsearchDocuments\b/,
      /\bexpandQueryTerms\b/,
      /\bcomputeBM25\b/,
    ],
    default_status: "evaluate",
    dependency_cost: "low",
    recommendation: "Add navigation primitives before semantic expansion: tree/list/glossary facets should reduce prompt load without adding embeddings.",
  },
  {
    id: "doc_code_entity_merge",
    signal: "Tree-sitter plus docs graph",
    evidence_patterns: [
      /\bmerge_doc_and_code\b/,
      /\bmergeDocAndCode\b/,
      /\bdoc(?:ument)?[_ -]?code[_ -]?entit/i,
      /\bentity[_ -]?merg/i,
    ],
    default_status: "defer",
    dependency_cost: "high",
    recommendation: "Extend deterministic document_graph toward doc-to-code edges only after current doc graph quality becomes a blocker.",
  },
  {
    id: "version_grounded_docs",
    signal: "version-aware external docs",
    evidence_patterns: [
      /\bversion(?:ed|ing)?[_ -]?(?:docs|source|package)/i,
      /\b(?:docs|source|package)[_ -]?version/i,
      /\bpackageVersion\b/,
    ],
    default_status: "evaluate",
    dependency_cost: "medium",
    recommendation: "Keep external-doc ingestion version-scoped and source-attributed; avoid one undifferentiated global docs cache.",
  },
  {
    id: "local_graph_memory",
    signal: "project/domain scoped graph memory",
    evidence_patterns: [
      /\bknowledge[_ -]?graph\b/i,
      /\bgraph[_ -]?(?:store|storage|memory)\b/i,
      /\bgraph(?:Store|Storage|Memory)/,
      /\b(?:node|edge)[_ -]?(?:store|storage|memory)\b/i,
    ],
    default_status: "evaluate",
    dependency_cost: "medium",
    recommendation: "Prefer scoped graph records with explicit source and supersession over free-form extracted memory blobs.",
  },
  {
    id: "watcher_as_optional_projection",
    signal: "file watcher and incremental refresh",
    evidence_patterns: [
      /\bwatch(?:er|Files?)?\b/,
      /\bincremental(?:ly)?\b/i,
      /\brefreshIndex\b/,
      /\breindexChanged\b/,
    ],
    default_status: "adopt_as_guardrail",
    dependency_cost: "low",
    recommendation: "Treat live watchers as optional projections; primary truth should remain rebuildable from files and specs.",
  },
  {
    id: "dependency_cost_gate",
    signal: "vector DB or external embedding dependency",
    dependency_patterns: [
      /(?:faiss|torch|transformers|sentence-transformers|lightrag)/i,
      /(?:qdrant|milvus|falkordb|chroma|lancedb)/i,
      /(?:openai|anthropic|google-genai)/i,
    ],
    default_status: "adopt_as_guardrail",
    dependency_cost: "avoid_until_blocked",
    recommendation: "Require a reproduced retrieval-quality or scale blocker before adding Qdrant, Milvus, FalkorDB, Chroma, LanceDB, or external embeddings.",
  },
];

function parseArgs(argv) {
  const opts = {
    corpusRoot: DEFAULT_CORPUS_ROOT,
    out: "",
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--corpus-root") {
      opts.corpusRoot = path.resolve(argv[++i] || "");
    } else if (arg.startsWith("--corpus-root=")) {
      opts.corpusRoot = path.resolve(arg.slice("--corpus-root=".length));
    } else if (arg === "--out") {
      opts.out = path.resolve(argv[++i] || "");
    } else if (arg.startsWith("--out=")) {
      opts.out = path.resolve(arg.slice("--out=".length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!opts.corpusRoot) throw new Error("--corpus-root must not be empty");
  return opts;
}

function normalizeRel(value) {
  return value.replaceAll("\\", "/");
}

function safeReadText(filePath, maxBytes = 256 * 1024) {
  const stat = fs.statSync(filePath);
  if (stat.size > maxBytes) return "";
  return fs.readFileSync(filePath, "utf8");
}

function walkFiles(rootDir, limit = 5000) {
  const files = [];
  const stack = [rootDir];
  while (stack.length && files.length < limit) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) stack.push(fullPath);
        continue;
      }
      if (entry.isFile()) files.push(fullPath);
      if (files.length >= limit) break;
    }
  }
  return files;
}

function extensionOf(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext || "(none)";
}

function classifyRole(relPath) {
  const name = path.basename(relPath).toLowerCase();
  const normalized = normalizeRel(relPath).toLowerCase();
  if (name === "readme.md") return "readme";
  if (
    /^(?:_?tests?|specs?)(?:\/|$)/.test(normalized)
    || normalized.includes("/test")
    || normalized.includes("/spec")
    || normalized.includes("_tests/")
  ) return "tests";
  if (normalized.includes("/doc") || normalized.endsWith(".md")) return "docs";
  if (["package.json", "pyproject.toml", "cargo.toml", "go.mod", "makefile", "docker-compose.yml"].includes(name)) return "manifest";
  if ([".js", ".ts", ".py", ".go", ".rs", ".c", ".cpp"].includes(path.extname(name))) return "source";
  return "other";
}

function increment(map, key, count = 1) {
  map.set(key, (map.get(key) || 0) + count);
}

function sortedCounts(map, limit = 12) {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function readPackageScripts(repoDir) {
  const packagePath = path.join(repoDir, "package.json");
  if (!fs.existsSync(packagePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    return Object.entries(parsed.scripts || {}).map(([name, command]) => ({ name, command: String(command) }));
  } catch {
    return [];
  }
}

function readMakeTargets(repoDir) {
  const makePath = path.join(repoDir, "Makefile");
  if (!fs.existsSync(makePath)) return [];
  const text = safeReadText(makePath);
  const targets = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_.-]+):(?:\s|$)/);
    if (match && !match[1].startsWith(".")) targets.push(match[1]);
  }
  return [...new Set(targets)].slice(0, 20);
}

function runGit(repoDir, args) {
  try {
    return childProcess.execFileSync("git", ["-C", repoDir, ...args], {
      encoding: "utf8",
      timeout: 3000,
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function readGitMetadata(repoDir) {
  const topLevel = runGit(repoDir, ["rev-parse", "--show-toplevel"]);
  if (!topLevel || path.resolve(topLevel) !== path.resolve(repoDir)) {
    return {
      present: false,
      head: "",
      branch: "",
      origin: "",
      dirty: false,
    };
  }
  const head = runGit(repoDir, ["rev-parse", "HEAD"]);
  if (!head) {
    return {
      present: false,
      head: "",
      branch: "",
      origin: "",
      dirty: false,
    };
  }
  return {
    present: true,
    head,
    branch: runGit(repoDir, ["branch", "--show-current"]),
    origin: runGit(repoDir, ["remote", "get-url", "origin"]),
    dirty: Boolean(runGit(repoDir, ["status", "--short"])),
  };
}

function normalizeDependencyName(value) {
  const match = String(value || "").trim().match(/^([A-Za-z0-9_.-]+)/);
  return match ? match[1] : "";
}

function readDependencyMetadata(repoDir) {
  const packagePath = path.join(repoDir, "package.json");
  if (fs.existsSync(packagePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      const runtime = Object.keys(parsed.dependencies || {}).sort();
      const development = Object.keys(parsed.devDependencies || {}).sort();
      return {
        manifest: "package.json",
        package_name: String(parsed.name || ""),
        package_version: String(parsed.version || ""),
        license: String(parsed.license || ""),
        runtime,
        development,
      };
    } catch {
      // Continue to another supported manifest.
    }
  }

  const pyprojectPath = path.join(repoDir, "pyproject.toml");
  if (fs.existsSync(pyprojectPath)) {
    const text = safeReadText(pyprojectPath);
    const dependencyBlock = text.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
    const runtime = dependencyBlock
      ? [...dependencyBlock[1].matchAll(/["']([^"']+)["']/g)]
        .map((match) => normalizeDependencyName(match[1]))
        .filter(Boolean)
        .sort()
      : [];
    return {
      manifest: "pyproject.toml",
      package_name: text.match(/^\s*name\s*=\s*["']([^"']+)["']/m)?.[1] || "",
      package_version: text.match(/^\s*version\s*=\s*["']([^"']+)["']/m)?.[1] || "",
      license: text.match(/^\s*license\s*=\s*\{\s*text\s*=\s*["']([^"']+)["']/m)?.[1] || "",
      runtime,
      development: [],
    };
  }

  return {
    manifest: "",
    package_name: "",
    package_version: "",
    license: "",
    runtime: [],
    development: [],
  };
}

function scanSignals(files, repoDir) {
  const byCategory = {};
  const evidence = {};
  for (const category of Object.keys(SIGNALS)) {
    byCategory[category] = 0;
    evidence[category] = [];
  }
  for (const filePath of files) {
    const ext = extensionOf(filePath);
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    let text = "";
    try {
      text = safeReadText(filePath);
    } catch {
      continue;
    }
    if (!text) continue;
    const rel = normalizeRel(path.relative(repoDir, filePath));
    for (const [category, patterns] of Object.entries(SIGNALS)) {
      let matched = false;
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          byCategory[category] += 1;
          matched = true;
        }
      }
      if (matched && evidence[category].length < 6) evidence[category].push(rel);
    }
  }
  return { byCategory, evidence };
}

function scanImplementationEvidence(files, repoDir, repo, dependencies) {
  const allowedCandidateIds = new Set(
    Array.isArray(repo.candidate_ids) && repo.candidate_ids.length
      ? repo.candidate_ids
      : TRANSPLANTS.map((item) => item.id)
  );
  const evidence = Object.fromEntries(TRANSPLANTS.map((item) => [item.id, []]));
  for (const filePath of files) {
    const rel = normalizeRel(path.relative(repoDir, filePath));
    if (classifyRole(rel) !== "source") continue;
    let text = "";
    try {
      text = safeReadText(filePath);
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (const transplant of TRANSPLANTS) {
      if (!allowedCandidateIds.has(transplant.id) || !transplant.evidence_patterns) continue;
      const bucket = evidence[transplant.id];
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (transplant.evidence_patterns.some((pattern) => pattern.test(line))) {
          bucket.push({
            path: rel,
            line: index + 1,
            text: line.trim().slice(0, 220),
          });
        }
      }
    }
  }

  for (const transplant of TRANSPLANTS) {
    evidence[transplant.id] = evidence[transplant.id]
      .sort((left, right) => implementationEvidenceScore(right) - implementationEvidenceScore(left)
        || left.path.localeCompare(right.path)
        || left.line - right.line)
      .slice(0, 8);
  }

  const dependencyNames = [...dependencies.runtime, ...dependencies.development];
  const dependencyGate = TRANSPLANTS.find((item) => item.id === "dependency_cost_gate");
  if (allowedCandidateIds.has("dependency_cost_gate")) {
    evidence.dependency_cost_gate = dependencyNames
      .filter((name) => dependencyGate.dependency_patterns.some((pattern) => pattern.test(name)))
      .slice(0, 12)
      .map((name) => ({ path: dependencies.manifest, line: 0, text: name }));
  }
  return evidence;
}

function implementationEvidenceScore(item) {
  let score = 0;
  if (/^(?:src|lib|app|repo_graphrag)\//.test(item.path)) score += 4;
  if (/\b(?:export\s+)?(?:async\s+)?function\s+\w+|\b(?:async\s+)?def\s+\w+|\bclass\s+\w+/.test(item.text)) score += 6;
  if (/^\s*(?:from|import)\b/.test(item.text)) score -= 4;
  if (/\b(?:test|fixture|example|standalone)\b/i.test(item.path)) score -= 3;
  return score;
}

function deriveTransplants(repo, implementationEvidence) {
  const allowedCandidateIds = new Set(
    Array.isArray(repo.candidate_ids) && repo.candidate_ids.length
      ? repo.candidate_ids
      : TRANSPLANTS.map((item) => item.id)
  );
  return TRANSPLANTS
    .filter((item) => allowedCandidateIds.has(item.id) && implementationEvidence[item.id]?.length > 0)
    .map((item) => ({
      id: item.id,
      signal: item.signal,
      status: item.default_status,
      dependency_cost: item.dependency_cost,
      evidence: implementationEvidence[item.id],
      recommendation: item.recommendation,
    }));
}

function analyzeRepository(corpusRoot, repo) {
  const repoDir = path.join(corpusRoot, repo.path);
  if (!fs.existsSync(repoDir) || !fs.statSync(repoDir).isDirectory()) {
    return {
      ...repo,
      present: false,
      path: normalizeRel(repo.path),
      file_count: 0,
      extension_counts: [],
      role_counts: [],
      package_scripts: [],
      make_targets: [],
      git: { present: false, head: "", branch: "", origin: "", dirty: false },
      dependencies: { manifest: "", package_name: "", package_version: "", license: "", runtime: [], development: [] },
      signals: {},
      signal_evidence: {},
      implementation_evidence: {},
      transplant_candidates: [],
    };
  }
  const files = walkFiles(repoDir);
  const extensions = new Map();
  const roles = new Map();
  for (const filePath of files) {
    const rel = normalizeRel(path.relative(repoDir, filePath));
    increment(extensions, extensionOf(filePath));
    increment(roles, classifyRole(rel));
  }
  const signalScan = scanSignals(files, repoDir);
  const dependencies = readDependencyMetadata(repoDir);
  const implementationEvidence = scanImplementationEvidence(files, repoDir, repo, dependencies);
  return {
    ...repo,
    present: true,
    path: normalizeRel(repo.path),
    file_count: files.length,
    extension_counts: sortedCounts(extensions),
    role_counts: sortedCounts(roles),
    package_scripts: readPackageScripts(repoDir).slice(0, 20),
    make_targets: readMakeTargets(repoDir),
    git: readGitMetadata(repoDir),
    dependencies,
    signals: signalScan.byCategory,
    signal_evidence: signalScan.evidence,
    implementation_evidence: implementationEvidence,
    transplant_candidates: deriveTransplants(repo, implementationEvidence),
  };
}

function buildReport(corpusRoot = DEFAULT_CORPUS_ROOT, repositories = DEFAULT_REPOSITORIES) {
  const repos = repositories.map((repo) => analyzeRepository(corpusRoot, repo));
  return {
    generated_at: new Date().toISOString(),
    corpus_root: normalizeRel(corpusRoot),
    repository_count: repos.length,
    present_count: repos.filter((repo) => repo.present).length,
    missing_count: repos.filter((repo) => !repo.present).length,
    repositories: repos,
    next_transplant_queue: [
      {
        priority: "P0",
        item: "Keep workbench knowledge index dependency-free until a measured retrieval blocker appears.",
        evidence: "Current local corpus shows useful structural patterns can be extracted from files without adding vector infrastructure.",
      },
      {
        priority: "P1",
        item: "Extend document_graph toward doc-to-code edges only after deterministic doc-only topology stops answering workflow questions.",
        evidence: "repo-graphrag and codebase-memory patterns both support entity merging, but mcp-tests currently needs stable workflow/document retrieval first.",
      },
      {
        priority: "P2",
        item: "Use corpus extraction reports as the default upstream-memory substrate before manually porting behavior.",
        evidence: "The extractor makes repo dissection repeatable and keeps transplant candidates auditable.",
      },
    ],
    second_pass_decisions: [
      {
        repository: "doctree-mcp",
        verdict: "adopt_patterns_only",
        patterns: [
          "heading hierarchy with stable section identity and source line spans",
          "glossary-assisted query expansion and facet prefiltering",
          "bounded match positions and density-oriented snippets",
        ],
        rationale: "The implementation is dependency-light, but its monolithic search routine should be decomposed before any local adaptation.",
        reopen_when: "A benchmark reproduces navigation or snippet-quality loss in the current deterministic knowledge index.",
      },
      {
        repository: "repo-graphrag-mcp",
        verdict: "defer",
        patterns: [
          "documentation-to-code entity reconciliation",
          "batched graph enrichment",
        ],
        rationale: "The current pin carries 26 runtime dependencies, including embedding, model-provider, Torch, Transformers, and FAISS layers. That cost is unjustified while deterministic document links answer current workflow questions.",
        reopen_when: "Exact path, symbol, and document-link joins fail a measured retrieval-quality criterion.",
      },
      {
        repository: "all tracked repositories",
        verdict: "adopt_guardrail",
        patterns: [
          "pin every inspected upstream revision",
          "require source-level implementation evidence",
          "record dependency cost before transplanting behavior",
        ],
        rationale: "Repository names, README claims, and keyword counts are discovery signals, not implementation evidence.",
        reopen_when: "Always active for future upstream reviews.",
      },
    ],
  };
}

function renderMarkdown(report) {
  const lines = [
    "# Upstream Repo Pattern Lab",
    "",
    "Status: active upstream extraction report",
    `Generated: ${report.generated_at}`,
    "",
    "## Purpose",
    "",
    "Keep a small, local, auditable corpus of high-value upstream repositories and extract engineering patterns before transplanting ideas into `mcp-tests`.",
    "",
    "This report is not a vendor recommendation list. It records observable repository structure, implementation signals, and bounded transplant candidates.",
    "",
    "## Corpus Summary",
    "",
    `- Corpus root: \`${report.corpus_root}\``,
    `- Repositories tracked: \`${report.repository_count}\``,
    `- Present locally: \`${report.present_count}\``,
    `- Missing locally: \`${report.missing_count}\``,
    "",
    "## Repositories",
    "",
  ];
  for (const repo of report.repositories) {
    lines.push(`### ${repo.id}`);
    lines.push("");
    lines.push(`- Upstream: ${repo.upstream}`);
    lines.push(`- Local path: \`${repo.path}\``);
    lines.push(`- Role: ${repo.role}`);
    lines.push(`- Present: \`${repo.present}\``);
    lines.push(`- File count sampled: \`${repo.file_count}\``);
    if (!repo.present) {
      lines.push("");
      continue;
    }
    lines.push(`- Upstream pin: \`${repo.git.head || "unavailable"}\`${repo.git.branch ? ` on \`${repo.git.branch}\`` : ""}${repo.git.dirty ? " (dirty)" : ""}`);
    lines.push(`- Manifest: \`${repo.dependencies.manifest || "unavailable"}\`; package \`${repo.dependencies.package_name || "unknown"}@${repo.dependencies.package_version || "unknown"}\`; license \`${repo.dependencies.license || "unknown"}\``);
    lines.push(`- Runtime dependencies: \`${repo.dependencies.runtime.length}\`${repo.dependencies.runtime.length ? ` (${repo.dependencies.runtime.slice(0, 12).join(", ")})` : ""}`);
    lines.push(`- Top extensions: ${repo.extension_counts.map((item) => `\`${item.name}:${item.count}\``).join(", ") || "none"}`);
    lines.push(`- Role counts: ${repo.role_counts.map((item) => `\`${item.name}:${item.count}\``).join(", ") || "none"}`);
    lines.push(`- Signals: ${Object.entries(repo.signals).map(([name, count]) => `\`${name}:${count}\``).join(", ")}`);
    if (repo.package_scripts.length) {
      lines.push(`- Package scripts: ${repo.package_scripts.map((item) => `\`${item.name}\``).join(", ")}`);
    }
    if (repo.make_targets.length) {
      lines.push(`- Make targets: ${repo.make_targets.map((item) => `\`${item}\``).join(", ")}`);
    }
    const evidence = Object.entries(repo.signal_evidence)
      .filter(([, files]) => files.length)
      .map(([name, files]) => `\`${name}\` -> ${files.slice(0, 3).map((file) => `\`${file}\``).join(", ")}`);
    if (evidence.length) {
      lines.push("- Evidence samples:");
      for (const item of evidence) lines.push(`  - ${item}`);
    }
    if (repo.transplant_candidates.length) {
      lines.push("- Transplant candidates:");
      for (const item of repo.transplant_candidates.slice(0, 5)) {
        lines.push(`  - \`${item.id}\` [status=\`${item.status}\`, dependency_cost=\`${item.dependency_cost}\`]: ${item.recommendation}`);
        for (const evidenceItem of item.evidence.slice(0, 4)) {
          const location = evidenceItem.line > 0 ? `${evidenceItem.path}:${evidenceItem.line}` : evidenceItem.path;
          lines.push(`    - Evidence: \`${location}\` -> \`${evidenceItem.text}\``);
        }
      }
    } else {
      lines.push("- Transplant candidates: none with source-level evidence in the current pin.");
    }
    lines.push("");
  }
  lines.push("## Next Transplant Queue");
  lines.push("");
  for (const item of report.next_transplant_queue) {
    lines.push(`- \`${item.priority}\` ${item.item}`);
    lines.push(`  Evidence: ${item.evidence}`);
  }
  lines.push("");
  lines.push("## Second-Pass Decisions");
  lines.push("");
  for (const item of report.second_pass_decisions) {
    lines.push(`### ${item.repository}`);
    lines.push("");
    lines.push(`- Verdict: \`${item.verdict}\``);
    lines.push(`- Patterns: ${item.patterns.map((pattern) => `\`${pattern}\``).join(", ")}`);
    lines.push(`- Rationale: ${item.rationale}`);
    lines.push(`- Reopen when: ${item.reopen_when}`);
    lines.push("");
  }
  lines.push("## Operating Rule");
  lines.push("");
  lines.push("Before adding retrieval or memory behavior to `mcp-tests`, run this extractor, inspect the relevant upstream repo locally, and save only distilled lessons or adopted decisions to persistent memory.");
  lines.push("");
  return `${lines.join("\n")}`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const report = buildReport(opts.corpusRoot);
  const output = opts.json ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report);
  if (opts.out) {
    fs.mkdirSync(path.dirname(opts.out), { recursive: true });
    fs.writeFileSync(opts.out, output, "utf8");
  } else {
    process.stdout.write(output);
  }
}

module.exports = {
  DEFAULT_REPOSITORIES,
  analyzeRepository,
  buildReport,
  renderMarkdown,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  }
}
