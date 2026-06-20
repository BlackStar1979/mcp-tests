"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const m = JSON.parse(fs.readFileSync("_workflow/patch_manifests/stage12_step38d_public_sandbox_propagation_gap_diagnosis.json", "utf8"));

assert.equal(m.status, "green_diagnosed");
assert.equal(m.step, "stage12_step38d_public_sandbox_propagation_gap_diagnosis");
assert.equal(m.root_repo_current.decision_runtime_context_builder_js_present, true);
assert.equal(m.local_public_sandbox.decision_runtime_context_builder_js_present, false);
assert.equal(m.connector_public_fs.decision_runtime_context_builder_js_present, false);
assert.equal(m.local_public_sandbox.tools_call_handler_size_bytes, m.connector_public_fs.tools_call_handler_size_bytes);
assert.equal(m.local_public_sandbox.tool_audit_helpers_size_bytes, m.connector_public_fs.tool_audit_helpers_size_bytes);
assert.equal(m.local_public_sandbox.rpc_message_dispatcher_size_bytes, m.connector_public_fs.rpc_message_dispatcher_size_bytes);
assert.equal(m.local_public_sandbox.unknown_tool_call_handler_size_bytes, m.connector_public_fs.unknown_tool_call_handler_size_bytes);
assert.equal(m.active_blocker, "public_sandbox_snapshot_stale");
assert.ok(m.obsolete_blockers_not_reintroduced.includes("permanent_no_runtime_restart"));
assert.ok(m.obsolete_blockers_not_reintroduced.includes("permanent_no_connector_refresh"));

console.log("smoke_stage12_step38d_public_sandbox_gap ok");
