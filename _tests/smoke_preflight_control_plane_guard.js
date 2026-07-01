"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const exists = (rel) => fs.existsSync(path.join(root, rel));
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const state = JSON.parse(read("_workflow/state.json"));

for (const rel of [
  "_workflow/scripts/test_mcp_backup.ps1",
  "_workflow/scripts/test_mcp_deploy.ps1",
  "_workflow/scripts/test_mcp_rollback.ps1",
  "_workflow/scripts/test_mcp_restart.ps1",
  "_tests/smoke_control_plane_deploy_rollback.js",
  "_workflow/control_plane/deploy_records",
  "_workflow/control_plane/file_backups",
  "_workflow/control_plane/snapshots",
  "_workflow/control_plane/retired_root_backups",
]) {
  assert.ok(exists(rel), `${rel} must exist`);
}

assert.equal(exists("_backups"), false, "root _backups must not exist");
assert.ok(canon.includes("Root `_backups/**` is retired and must not be recreated."));
assert.ok(index.includes("stage14_2b_repo_gremlin_double_scan.md"));
assert.equal(state.schema_version, "workflow-state-spec-map-v2");
assert.ok(!Object.hasOwn(state, "stage14"));

console.log("smoke_preflight_control_plane_guard ok");
