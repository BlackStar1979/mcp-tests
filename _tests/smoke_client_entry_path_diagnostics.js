"use strict";

const assert = require("node:assert/strict");
const { buildClientEntryPathDiagnostics } = require("../src/client_entry_path_diagnostics");

const runtimeStatus = {
  server_start_id: "start-a",
  request_contract: {
    route: "/mcp",
    post_only: true,
    initialize_required: false,
    protocol_sessions: false,
    server_discover_supported: true,
    legacy_initialize_supported: true,
    transport_mode: "streamable_http_stateless_legacy_initialize_compat",
  },
};

const initializeOnly = buildClientEntryPathDiagnostics([
  { ts: "2026-07-03T10:00:00.000Z", event: "server_start", server_start_id: "start-a" },
  { ts: "2026-07-03T10:00:01.000Z", event: "initialize_received", request_id: "r1", server_start_id: "start-a", client_name: "codex", client_version: "1", protocol_version: "2025-06-18" },
  { ts: "2026-07-03T10:00:01.100Z", event: "rpc_response_sent", request_id: "r1", server_start_id: "start-a", status_code: 200, response_mode: "json", phase: "single_json_response", has_result: true, has_error: false, response_bytes: 123 },
], runtimeStatus);
assert.equal(initializeOnly.status, "initialize_only");
assert.equal(initializeOnly.initialize_observed_for_current_start, true);
assert.equal(initializeOnly.server_discover_observed_for_current_start, false);
assert.equal(initializeOnly.initialize_response_observed_for_current_start, true);
assert.equal(initializeOnly.followup_traffic_without_fresh_entry, false);
assert.equal(initializeOnly.current_window_counts.initialize_response_sent, 1);
assert.equal(initializeOnly.current_window_counts.initialize_response_success, 1);
assert.equal(initializeOnly.current_window_counts.initialize_response_error, 0);
assert.equal(initializeOnly.last_initialize_response.status_code, 200);
assert.equal(initializeOnly.last_initialize_response.has_result, true);

const discoverOnly = buildClientEntryPathDiagnostics([
  { ts: "2026-07-03T10:00:00.000Z", event: "server_start", server_start_id: "start-a" },
  { ts: "2026-07-03T10:00:01.000Z", event: "server_discover_received", request_id: "r2", server_start_id: "start-a", client_name: "claude", client_version: "1", protocol_version: "2025-06-18" },
  { ts: "2026-07-03T10:00:01.100Z", event: "rpc_response_sent", request_id: "r2", server_start_id: "start-a", status_code: 200, response_mode: "json", phase: "single_json_response", has_result: true, has_error: false, response_bytes: 456 },
], runtimeStatus);
assert.equal(discoverOnly.status, "server_discover_only");
assert.equal(discoverOnly.initialize_observed_for_current_start, false);
assert.equal(discoverOnly.server_discover_observed_for_current_start, true);
assert.equal(discoverOnly.server_discover_response_observed_for_current_start, true);
assert.equal(discoverOnly.followup_traffic_without_fresh_entry, false);
assert.equal(discoverOnly.current_window_counts.server_discover_response_sent, 1);
assert.equal(discoverOnly.current_window_counts.server_discover_response_success, 1);
assert.equal(discoverOnly.current_window_counts.server_discover_response_error, 0);
assert.equal(discoverOnly.last_server_discover_response.status_code, 200);

const mixed = buildClientEntryPathDiagnostics([
  { ts: "2026-07-03T10:00:00.000Z", event: "server_start", server_start_id: "start-a" },
  { ts: "2026-07-03T10:00:01.000Z", event: "initialize_received", request_id: "r1", server_start_id: "start-a" },
  { ts: "2026-07-03T10:00:02.000Z", event: "server_discover_received", request_id: "r2", server_start_id: "start-a" },
  { ts: "2026-07-03T10:00:02.100Z", event: "rpc_response_sent", request_id: "r1", server_start_id: "start-a", status_code: 200, response_mode: "json", phase: "single_json_response", has_result: true, has_error: false, response_bytes: 100 },
  { ts: "2026-07-03T10:00:02.200Z", event: "rpc_response_sent", request_id: "r2", server_start_id: "start-a", status_code: 400, response_mode: "json", phase: "single_json_response", has_result: false, has_error: true, error_code: -32600, response_bytes: 80 },
], runtimeStatus);
assert.equal(mixed.status, "mixed_initialize_and_server_discover");
assert.equal(mixed.current_window_counts.initialize_received, 1);
assert.equal(mixed.current_window_counts.server_discover_received, 1);
assert.equal(mixed.current_window_counts.initialize_response_sent, 1);
assert.equal(mixed.current_window_counts.server_discover_response_sent, 1);
assert.equal(mixed.current_window_counts.initialize_response_success, 1);
assert.equal(mixed.current_window_counts.initialize_response_error, 0);
assert.equal(mixed.current_window_counts.server_discover_response_success, 0);
assert.equal(mixed.current_window_counts.server_discover_response_error, 1);
assert.equal(mixed.followup_traffic_without_fresh_entry, false);
assert.equal(mixed.request_contract.server_discover_supported, true);
assert.equal(mixed.last_server_discover_response.error_code, -32600);

const duplicateRequestIdsAcrossRestarts = buildClientEntryPathDiagnostics([
  { ts: "2026-07-03T09:59:59.000Z", event: "server_start", server_start_id: "start-old" },
  { ts: "2026-07-03T09:59:59.100Z", event: "initialize_received", request_id: "dup-1", server_start_id: "start-old", client_name: "codex", client_version: "old" },
  { ts: "2026-07-03T09:59:59.200Z", event: "rpc_response_sent", request_id: "dup-1", server_start_id: "start-old", status_code: 500, response_mode: "json", phase: "single_json_response", has_result: false, has_error: true, error_code: -32603, response_bytes: 80 },
  { ts: "2026-07-03T10:00:00.000Z", event: "server_start", server_start_id: "start-a" },
  { ts: "2026-07-03T10:00:01.000Z", event: "initialize_received", request_id: "dup-1", server_start_id: "start-a", client_name: "codex", client_version: "new" },
  { ts: "2026-07-03T10:00:01.100Z", event: "rpc_response_sent", request_id: "dup-1", server_start_id: "start-a", status_code: 200, response_mode: "json", phase: "single_json_response", has_result: true, has_error: false, response_bytes: 123 },
], runtimeStatus);
assert.equal(duplicateRequestIdsAcrossRestarts.last_initialize.server_start_id, "start-a");
assert.equal(duplicateRequestIdsAcrossRestarts.last_initialize_response.server_start_id, "start-a");
assert.equal(duplicateRequestIdsAcrossRestarts.last_initialize_response.status_code, 200);
assert.equal(duplicateRequestIdsAcrossRestarts.current_window_counts.initialize_response_success, 1);
assert.equal(duplicateRequestIdsAcrossRestarts.current_window_counts.initialize_response_error, 0);

const responseWithoutServerStartIdUsesRequestScopedCorrelation = buildClientEntryPathDiagnostics([
  { ts: "2026-07-03T09:00:00.000Z", event: "server_start", server_start_id: "start-a" },
  { ts: "2026-07-03T09:00:01.000Z", event: "initialize_received", request_id: "req-1", server_start_id: "start-a", client_name: "codex", client_version: "1" },
  { ts: "2026-07-03T09:00:02.000Z", event: "server_start", server_start_id: "unrelated-start" },
  { ts: "2026-07-03T09:00:03.000Z", event: "rpc_response_sent", request_id: "req-1", status_code: 200, response_mode: "json", phase: "single_json_response", has_result: true, has_error: false, response_bytes: 55 },
], runtimeStatus);
assert.equal(responseWithoutServerStartIdUsesRequestScopedCorrelation.last_initialize.server_start_id, "start-a");
assert.equal(responseWithoutServerStartIdUsesRequestScopedCorrelation.last_initialize_response.server_start_id, "start-a");
assert.equal(responseWithoutServerStartIdUsesRequestScopedCorrelation.last_initialize_response.status_code, 200);
assert.equal(responseWithoutServerStartIdUsesRequestScopedCorrelation.current_window_counts.initialize_response_success, 1);

const followupOnlyWindow = buildClientEntryPathDiagnostics([
  { ts: "2026-07-03T10:00:00.000Z", event: "server_start", server_start_id: "start-a" },
  { ts: "2026-07-03T10:00:01.000Z", event: "rpc_received", server_start_id: "start-a", method: "tools/list" },
  { ts: "2026-07-03T10:00:02.000Z", event: "tool_call_start", server_start_id: "start-a", request_id: "r3", tool: "get_info" },
], runtimeStatus);
assert.equal(followupOnlyWindow.status, "no_current_entry_observed");
assert.equal(followupOnlyWindow.followup_traffic_without_fresh_entry, true);
assert.equal(followupOnlyWindow.current_window_counts.tools_list_rpc, 1);
assert.equal(followupOnlyWindow.current_window_counts.tools_call_start, 1);

console.log("smoke_client_entry_path_diagnostics ok");
