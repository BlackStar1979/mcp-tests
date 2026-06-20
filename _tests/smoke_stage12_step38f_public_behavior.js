"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const m = JSON.parse(fs.readFileSync("_workflow/patch_manifests/stage12_step38f_public_connector_runtime_behavior_verification.json", "utf8"));

assert.equal(m.status, "green_with_typed_interface_limit");
assert.equal(m.public_fs_synced_files_visible, true);
assert.equal(m.public_search_known_tool_ok, true);
assert.equal(m.public_fetch_known_tool_ok, true);
assert.equal(m.public_fetch_invalid_id_domain_error_ok, true);
assert.equal(m.typed_connector_unknown_tool_direct_call_available, false);
assert.equal(m.unknown_tool_behavior_verified_by_local_smoke, true);
assert.equal(m.malformed_context_behavior_verified_by_local_smoke, true);
assert.equal(m.observability_ok, true);
assert.equal(m.observability_server_errors, 0);
assert.equal(m.observability_unknown_tool_count, 0);
assert.equal(m.tool_surface_changed, false);
assert.equal(m.bearer_tool_count, 46);
assert.equal(m.bearer_tool_hash, "f47c9460e21079a8");
assert.equal(m.auth_config_change, false);
assert.equal(m.cli_change, false);
assert.equal(m.db_network_memory_plugin_change, false);
assert.equal(m.restart_performed, false);
assert.equal(m.connector_refresh_performed, false);

console.log("smoke_stage12_step38f_public_behavior ok");
