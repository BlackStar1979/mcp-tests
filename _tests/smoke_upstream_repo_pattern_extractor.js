"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  analyzeRepository,
  buildReport,
  renderMarkdown,
} = require("../scripts/extract_upstream_repo_patterns");

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-upstream-patterns-"));

try {
  const repoDir = path.join(fixtureRoot, "fixture-doc-graph");
  fs.mkdirSync(path.join(repoDir, "src"), { recursive: true });
  fs.writeFileSync(path.join(repoDir, "README.md"), [
    "# Fixture",
    "",
    "MCP server with BM25, graph nodes and edges, SQLite WAL, frontmatter, Tree-sitter, and incremental watcher refresh.",
  ].join("\n"), "utf8");
  fs.writeFileSync(path.join(repoDir, "package.json"), JSON.stringify({
    scripts: {
      index: "node src/index.js",
      test: "node test.js",
    },
  }, null, 2), "utf8");
  fs.writeFileSync(path.join(repoDir, "src", "index.js"), [
    "server.registerTool('search_graph', async () => ({}));",
    "const storage = 'sqlite wal json';",
    "const retrieval = 'semantic vector hybrid rerank mmr';",
  ].join("\n"), "utf8");

  const repo = analyzeRepository(fixtureRoot, {
    id: "fixture",
    path: "fixture-doc-graph",
    upstream: "https://example.test/fixture",
    role: "test fixture",
  });

  assert.equal(repo.present, true);
  assert.equal(repo.file_count, 3);
  assert.ok(repo.signals.retrieval >= 1);
  assert.ok(repo.signals.graph >= 1);
  assert.ok(repo.signals.storage >= 1);
  assert.ok(repo.signals.updates >= 1);
  assert.ok(repo.package_scripts.some((item) => item.name === "index"));
  assert.ok(repo.transplant_candidates.some((item) => item.id === "bounded_tree_navigation"));
  assert.ok(repo.transplant_candidates.some((item) => item.id === "local_graph_memory"));

  const report = buildReport(fixtureRoot, [{
    id: "fixture",
    path: "fixture-doc-graph",
    upstream: "https://example.test/fixture",
    role: "test fixture",
  }]);
  assert.equal(report.repository_count, 1);
  assert.equal(report.present_count, 1);
  assert.equal(report.missing_count, 0);

  const markdown = renderMarkdown(report);
  assert.ok(markdown.includes("# Upstream Repo Pattern Lab"));
  assert.ok(markdown.includes("fixture-doc-graph"));
  assert.ok(markdown.includes("Next Transplant Queue"));

  console.log("smoke_upstream_repo_pattern_extractor ok");
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
