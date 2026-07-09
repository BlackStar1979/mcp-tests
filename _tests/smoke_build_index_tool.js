"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const { buildIndexTool } = require("../tools/build_index");
const { indexStatusTool } = require("../tools/index_status");

const ROOT = path.resolve(__dirname, "..");
const INDEX_FILE = path.join(ROOT, "_control", "smoke-build-index.json");

(async () => {
  const previous = process.env.MCP_TEST_WORKSPACE_INDEX_FILE;
  process.env.MCP_TEST_WORKSPACE_INDEX_FILE = INDEX_FILE;
  await fs.rm(INDEX_FILE, { force: true });

  try {
    const build = await buildIndexTool.execute({ max_files: 200, max_dirs: 200 });
    assert.equal(build.status, "built");
    assert.equal(build.success, true);
    assert.ok(build.count > 0);

    const status = await indexStatusTool.execute();
    assert.equal(status.status, "ok");
    assert.equal(status.success, true);
    assert.ok(status.count > 0);
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
