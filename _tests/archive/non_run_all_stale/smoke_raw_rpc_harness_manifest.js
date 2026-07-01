"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const m = JSON.parse(fs.readFileSync("_workflow/patch_manifests/stage12_step38g_raw_rpc_unknown_tool_harness.json", "utf8"));

assert.equal(m.status, "green_raw_rpc_harness_added");
assert.equal(m.raw_rpc_harness_added, true);
assert.equal(m.new_mcp_tool_added, false);
assert.equal(m.connector_visible_tool_surface_change, false);
assert.equal(m.unknown_tool_error_verified, true);
assert.equal(m.unknown_tool_error_code, -32602);
assert.equal(m.malformed_context_error_verified, true);
assert.equal(m.malformed_context_error_code, -32602);
assert.equal(m.observability_verified, true);
assert.equal(m.observability_server_errors, 0);
assert.equal(m.tool_surface_changed, false);
assert.equal(m.bearer_tool_count, 46);
assert.equal(m.bearer_tool_hash, "f47c9460e21079a8");
assert.equal(m.auth_config_change, false);
assert.equal(m.cli_change, false);
assert.equal(m.db_network_memory_plugin_change, false);
assert.equal(m.restart_performed, false);
assert.equal(m.connector_refresh_performed, false);
assert.equal(m.stale_control_resolved, "typed_connector_raw_unknown_tool_limit_for_behavior_verification");

console.log("smoke_raw_rpc_harness_manifest ok");
