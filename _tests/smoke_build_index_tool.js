"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const { buildIndexTool } = require("../tools/build_index");
const { collectContextTool } = require("../tools/collect_context");
const { indexStatusTool } = require("../tools/index_status");
const { searchIndexContextTool } = require("../tools/search_index_context");
const { searchIndexTool } = require("../tools/search_index");
const { buildWorkspaceIndex, searchIndex } = require("../src/util/workspace_index");

const ROOT = path.resolve(__dirname, "..");
const INDEX_FILE = path.join(ROOT, "_control", "smoke-build-index.json");

(async () => {
  const previous = process.env.MCP_TEST_WORKSPACE_INDEX_FILE;
  process.env.MCP_TEST_WORKSPACE_INDEX_FILE = INDEX_FILE;
  await fs.rm(INDEX_FILE, { force: true });

  try {
    const missing = await indexStatusTool.execute();
    assert.equal(missing.status, "missing");
    assert.equal(missing.success, true);
    assert.equal(missing.truncated, false);
    assert.equal(missing.visited_files, 0);
    assert.equal(missing.max_files, 0);

    const build = await buildIndexTool.execute({ max_files: 200, max_dirs: 200 });
    assert.equal(build.status, "built");
    assert.equal(build.success, true);
    assert.ok(build.count > 0);
    assert.equal(build.scope.path, ".");
    assert.equal(build.scope.mode, "all_roots");
    assert.equal(build.max_files, 200);
    assert.equal(build.max_dirs, 200);

    const status = await indexStatusTool.execute();
    assert.equal(status.status, "ok");
    assert.equal(status.success, true);
    assert.ok(status.count > 0);
    assert.equal(status.visited_files, build.visited_files);
    assert.equal(status.visited_dirs, build.visited_dirs);
    assert.equal(status.truncated, build.truncated);
    assert.equal(status.max_files, 200);
    assert.equal(status.max_dirs, 200);
    assert.deepEqual(status.scope, build.scope);
    assert.deepEqual(status.skipped, build.skipped);

    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "workspace-index-archive-skip-"));
    const isolatedIndexFile = path.join(tempRoot, "workspace-index.json");
    try {
      await fs.mkdir(path.join(tempRoot, "docs"), { recursive: true });
      await fs.mkdir(path.join(tempRoot, ".archive", "docs"), { recursive: true });
      await fs.writeFile(path.join(tempRoot, "docs", "live.md"), "# Live doc\nfollowup_traffic_without_fresh_entry\n", "utf8");
      await fs.writeFile(path.join(tempRoot, ".archive", "docs", "archived.md"), "# Archived doc\nfollowup_traffic_without_fresh_entry\n", "utf8");
      await fs.mkdir(path.join(tempRoot, "other"), { recursive: true });
      await fs.writeFile(path.join(tempRoot, "other", "outside.md"), "# Outside\nscoped-only-token\n", "utf8");
      await fs.mkdir(path.join(tempRoot, "_repos_with_code_samples", "sample"), { recursive: true });
      await fs.writeFile(path.join(tempRoot, "_repos_with_code_samples", "sample", "fixture.md"), "# Fixture\nsample-fixture-token\n", "utf8");
      await fs.mkdir(path.join(tempRoot, "_workflow", "control_plane", "snapshots", "old", "_workflow"), { recursive: true });
      await fs.writeFile(path.join(tempRoot, "_workflow", "state.json"), "{\"live_package_marker\":\"live-state-token\"}\n", "utf8");
      await fs.writeFile(path.join(tempRoot, "_workflow", "control_plane", "snapshots", "old", "_workflow", "state.json"), "{\"live_package_marker\":\"snapshot-state-token\"}\n", "utf8");

      const isolatedRoots = new Map([["work", tempRoot]]);
      const isolated = await buildWorkspaceIndex({
        roots: isolatedRoots,
        indexFile: isolatedIndexFile,
        max_files: 100,
        max_dirs: 100,
      });

      assert.equal(isolated.stats.skipped.directories >= 1, true);
      assert.equal(isolated.docs.some((doc) => doc.path.includes(".archive")), false);
      assert.equal(isolated.docs.some((doc) => doc.path.includes("_repos_with_code_samples")), false);
      assert.equal(isolated.docs.some((doc) => doc.path.includes("_workflow/control_plane/snapshots")), false);

      const stateSearch = await searchIndex("live_package_marker live-state-token", {
        limit: 10,
        indexFile: isolatedIndexFile,
      });
      assert.equal(stateSearch.success, true);
      assert.equal(stateSearch.results[0].path, "_workflow/state.json");
      assert.equal(stateSearch.results.some((item) => item.path.includes("_workflow/control_plane/snapshots")), false);

      const previousIndexFileForFilterTools = process.env.MCP_TEST_WORKSPACE_INDEX_FILE;
      process.env.MCP_TEST_WORKSPACE_INDEX_FILE = isolatedIndexFile;
      try {
        const filteredSearch = await searchIndexTool.execute({ query: "followup_traffic_without_fresh_entry", path: "docs", limit: 10 });
        assert.equal(filteredSearch.success, true);
        assert.equal(filteredSearch.results.every((item) => item.path.startsWith("docs/")), true);
        assert.equal(filteredSearch.results.some((item) => item.path === "docs/live.md"), true);

        const filteredContext = await searchIndexContextTool.execute({ query: "followup_traffic_without_fresh_entry", path: "docs", limit: 10 });
        assert.equal(filteredContext.success, true);
        assert.equal(filteredContext.results.every((item) => item.path.startsWith("docs/")), true);

        const filteredCollect = await collectContextTool.execute({ query: "followup_traffic_without_fresh_entry", path: "docs", limit: 10 });
        assert.equal(filteredCollect.success, true);
        assert.equal(filteredCollect.files.every((item) => item.path.startsWith("docs/")), true);
      } finally {
        if (previousIndexFileForFilterTools === undefined) delete process.env.MCP_TEST_WORKSPACE_INDEX_FILE;
        else process.env.MCP_TEST_WORKSPACE_INDEX_FILE = previousIndexFileForFilterTools;
      }

      const scoped = await buildWorkspaceIndex({
        roots: isolatedRoots,
        indexFile: isolatedIndexFile,
        path: "docs",
        max_files: 100,
        max_dirs: 100,
      });
      assert.equal(scoped.scope.path, "docs");
      assert.equal(scoped.scope.display_path, "docs");
      assert.equal(scoped.scope.mode, "directory");
      assert.equal(scoped.docs.some((doc) => doc.path === "docs/live.md"), true);
      assert.equal(scoped.docs.some((doc) => doc.path === "other/outside.md"), false);

      const liveSearch = await searchIndex("followup_traffic_without_fresh_entry", {
        limit: 10,
        indexFile: isolatedIndexFile,
      });
      assert.equal(liveSearch.success, true);
      assert.equal(liveSearch.results.length >= 1, true);
      assert.equal(liveSearch.results.some((item) => item.path.includes(".archive")), false);
      assert.equal(liveSearch.results[0].path, "docs/live.md");

      const outsideSearch = await searchIndex("scoped-only-token", {
        limit: 10,
        indexFile: isolatedIndexFile,
      });
      assert.equal(outsideSearch.success, true);
      assert.equal(outsideSearch.results.length, 0);

      const fixtureSearch = await searchIndex("sample-fixture-token", {
        limit: 10,
        indexFile: isolatedIndexFile,
      });
      assert.equal(fixtureSearch.success, true);
      assert.equal(fixtureSearch.results.length, 0);

      await fs.mkdir(path.join(tempRoot, "src"), { recursive: true });
      await fs.writeFile(
        path.join(tempRoot, "src", "client_entry_path_diagnostics.js"),
        "\"use strict\";\nmodule.exports = { value: 'followup_traffic_without_fresh_entry' };\n",
        "utf8"
      );
      await fs.writeFile(
        path.join(tempRoot, "src", "initialize_response.js"),
        "\"use strict\";\n// client entry path diagnostics initialize response correlation followup_traffic_without_fresh_entry\n",
        "utf8"
      );

      await buildWorkspaceIndex({
        roots: isolatedRoots,
        indexFile: isolatedIndexFile,
        max_files: 100,
        max_dirs: 100,
      });

      const filenamePrioritySearch = await searchIndex("client_entry_path_diagnostics followup_traffic_without_fresh_entry initialize response correlation", {
        limit: 10,
        indexFile: isolatedIndexFile,
      });
      assert.equal(filenamePrioritySearch.success, true);
      assert.equal(filenamePrioritySearch.results[0].path, "src/client_entry_path_diagnostics.js");

      const largeFile = path.join(tempRoot, "docs", "large.md");
      const largeText = Array.from({ length: 4000 }, (_, index) => `line-${String(index + 1).padStart(4, "0")} ${"x".repeat(80)}`).join("\n");
      await fs.writeFile(largeFile, largeText, "utf8");

      const originalReadFile = fs.readFile;
      let blockedReads = 0;
      fs.readFile = async function blocked(filePath, ...rest) {
        if (path.resolve(String(filePath)) === path.resolve(largeFile)) {
          blockedReads += 1;
          throw new Error(`full read blocked for ${filePath}`);
        }
        return originalReadFile.call(this, filePath, ...rest);
      };

      try {
        const streamedIndex = await buildWorkspaceIndex({
          roots: isolatedRoots,
          indexFile: isolatedIndexFile,
          max_files: 100,
          max_dirs: 100,
        });
        const largeDoc = streamedIndex.docs.find((doc) => doc.path === "docs/large.md");
        assert.ok(largeDoc, "large doc should be indexed");
        assert.equal(largeDoc.sample.length, 12000);
        assert.equal(largeDoc.sample, largeText.slice(0, 12000));
        assert.equal(blockedReads, 0);
      } finally {
        fs.readFile = originalReadFile;
      }
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }

    await fs.writeFile(INDEX_FILE, "{not-json", "utf8");
    const corrupt = await indexStatusTool.execute();
    assert.equal(corrupt.status, "error");
    assert.equal(corrupt.success, false);
    assert.equal(corrupt.truncated, false);
    assert.equal(corrupt.visited_files, 0);
    assert.match(corrupt.error, /json|unexpected token|expected property name/i);
    console.log("smoke_build_index_tool ok");
  } finally {
    if (previous === undefined) delete process.env.MCP_TEST_WORKSPACE_INDEX_FILE;
    else process.env.MCP_TEST_WORKSPACE_INDEX_FILE = previous;
    await fs.rm(INDEX_FILE, { force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
