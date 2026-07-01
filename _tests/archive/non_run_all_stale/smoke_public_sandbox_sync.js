"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const m = JSON.parse(fs.readFileSync("_workflow/patch_manifests/stage12_step38e_public_sandbox_sync.json", "utf8"));
const files = m.files_synced;

assert.equal(m.status, "green_synced");
assert.equal(m.assistant_performed_sync, true);
assert.equal(m.public_connector_fs_now_sees_synced_files, true);
assert.equal(m.connector_visible_tool_surface_change, false);
assert.equal(m.auth_config_change, false);
assert.equal(m.cli_change, false);
assert.equal(m.db_network_memory_plugin_change, false);
assert.equal(m.restart_performed, false);
assert.equal(m.connector_refresh_performed, false);
assert.equal(m.stale_blocker_resolved, "public_sandbox_snapshot_stale");

for (const rel of files) {
  const source = rel;
  const target = `_public_sandbox/mcp-tests/${rel}`;
  assert.equal(fs.existsSync(source), true, `${source} must exist`);
  assert.equal(fs.existsSync(target), true, `${target} must exist`);
  assert.equal(fs.statSync(target).size, fs.statSync(source).size, `${rel} size mismatch`);
}

console.log("smoke_public_sandbox_sync ok");
