"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const { buildObservabilityStatus } = require("../src/observability_status");
const { buildToolsListCacheDiagnostics } = require("../src/tools_list_cache_diagnostics");

function runtimeStatus() {
  return {
    server_version: "0.40.0",
    stage_status: "stage",
    server_start_id: "start-a",
    auth: { mode: "oauth21" },
    profile: { mode: "internal" },
    enabled_tools: ["test_mcp_runtime_status"],
    tool_surface: { tool_count: 1, tool_names_hash: "hash-a", combined_fingerprint: "fp-a" },
    security_boundary: { status: "ok" },
  };
}

const noList = buildObservabilityStatus({
  args: { window_size: 50, slow_ms: 1000, top_n: 5 },
  runtimeStatusProvider: runtimeStatus,
  auditLogPath: path.join(__dirname, "fixtures", "tools_list_cache_no_list_fixture.jsonl"),
});
assert.equal(noList.success, true);
assert.equal(noList.tools_list_cache_diagnostics.status, "tools_call_after_initialize_without_tools_list");
assert.equal(noList.tools_list_cache_diagnostics.current_server_start_id, "start-a");
assert.equal(noList.tools_list_cache_diagnostics.current_window_counts.initialize_received, 1);
assert.equal(noList.tools_list_cache_diagnostics.current_window_counts.tools_list_served, 0);
assert.equal(noList.tools_list_cache_diagnostics.current_window_counts.tools_call_start, 1);
assert.equal(noList.tools_list_cache_diagnostics.tools_call_after_initialize_without_tools_list, true);
assert.ok(noList.recommended_actions[0].includes("tools-list cache diagnostic"));

const withList = buildObservabilityStatus({
  args: { window_size: 50, slow_ms: 1000, top_n: 5 },
  runtimeStatusProvider: runtimeStatus,
  auditLogPath: path.join(__dirname, "fixtures", "tools_list_cache_with_list_fixture.jsonl"),
});
assert.equal(withList.success, true);
assert.equal(withList.tools_list_cache_diagnostics.status, "tools_list_observed_for_current_start");
assert.equal(withList.tools_list_cache_diagnostics.current_window_counts.tools_list_rpc, 1);
assert.equal(withList.tools_list_cache_diagnostics.current_window_counts.tools_list_served, 1);
assert.equal(withList.tools_list_cache_diagnostics.tools_call_after_initialize_without_tools_list, false);
assert.equal(withList.tools_list_cache_diagnostics.ttl_cache_directive_observed, true);
assert.equal(withList.tools_list_cache_diagnostics.last_tools_list_cache_directive.ttl_ms, 0);
assert.equal(withList.tools_list_cache_diagnostics.last_tools_list_cache_directive.cache_scope, "private");
assert.equal(withList.tools_list_cache_diagnostics.last_tools_list_served.fingerprint, "fp-a");

const direct = buildToolsListCacheDiagnostics([], runtimeStatus());
assert.equal(direct.status, "no_current_session_observed");
assert.equal(direct.current_tool_surface_fingerprint, "fp-a");
console.log("smoke_tools_list_cache_observability ok");
