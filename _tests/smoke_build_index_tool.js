"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const { buildIndexTool } = require("../tools/build_index");
const { indexStatusTool } = require("../tools/index_status");
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

    const build = await buildIndexTool.execute({ max_files: 200, max_dirs: 200 });
    assert.equal(build.status, "built");
    assert.equal(build.success, true);
    assert.ok(build.count > 0);

    const status = await indexStatusTool.execute();
    assert.equal(status.status, "ok");
    assert.equal(status.success, true);
    assert.ok(status.count > 0);

    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "workspace-index-archive-skip-"));
    const isolatedIndexFile = path.join(tempRoot, "workspace-index.json");
    try {
      await fs.mkdir(path.join(tempRoot, "docs"), { recursive: true });
      await fs.mkdir(path.join(tempRoot, ".archive", "docs"), { recursive: true });
      await fs.writeFile(path.join(tempRoot, "docs", "live.md"), "# Live doc\nfollowup_traffic_without_fresh_entry\n", "utf8");
      await fs.writeFile(path.join(tempRoot, ".archive", "docs", "archived.md"), "# Archived doc\nfollowup_traffic_without_fresh_entry\n", "utf8");

      const isolatedRoots = new Map([["work", tempRoot]]);
      const isolated = await buildWorkspaceIndex({
        roots: isolatedRoots,
        indexFile: isolatedIndexFile,
        max_files: 100,
        max_dirs: 100,
      });

      assert.equal(isolated.stats.skipped.directories >= 1, true);
      assert.equal(isolated.docs.some((doc) => doc.path.includes(".archive")), false);

      const liveSearch = await searchIndex("followup_traffic_without_fresh_entry", {
        limit: 10,
        indexFile: isolatedIndexFile,
      });
      assert.equal(liveSearch.success, true);
      assert.equal(liveSearch.results.length >= 1, true);
      assert.equal(liveSearch.results.some((item) => item.path.includes(".archive")), false);
      assert.equal(liveSearch.results[0].path, "docs/live.md");
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }

    await fs.writeFile(INDEX_FILE, "{not-json", "utf8");
    const corrupt = await indexStatusTool.execute();
    assert.equal(corrupt.status, "error");
    assert.equal(corrupt.success, false);
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
