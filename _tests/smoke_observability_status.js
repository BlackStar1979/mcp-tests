const assert = require("node:assert/strict");
const { CURRENT_STAGE_STATUS, CURRENT_COMPATIBILITY_LABEL } = require("../src/stage_metadata");
const path = require("node:path");
const { buildObservabilityStatus } = require("../src/observability_status");
const { createObservabilityStatusTool } = require("../tools/observability_status");

const auditLogPath = path.join(__dirname, "..", "_logs", ".mcp-tests-audit.jsonl");

const runtimeStatus = {
  server_version: "0.40.0",
  compatibility_label: CURRENT_COMPATIBILITY_LABEL,
  stage_status: CURRENT_STAGE_STATUS,
  auth: { mode: "none" },
  profile: { mode: "public" },
  request_contract: {
    route: "/mcp",
    post_only: true,
    initialize_required: false,
    protocol_sessions: false,
    server_discover_supported: true,
    legacy_initialize_supported: true,
    transport_mode: "streamable_http_stateless_legacy_initialize_compat",
  },
  enabled_tools: ["search", "fetch", "observability_status"],
  security_boundary: { status: "ok" },
};

const status = buildObservabilityStatus({
  args: {
    window_size: 200,
    slow_ms: 1,
    top_n: 5,
    connector_visible_tools: ["search", "fetch"],
  },
  runtimeStatusProvider: () => runtimeStatus,
  auditLogPath,
});

assert.equal(status.success, true);
assert.equal(status.mode, "observability-status");
assert.equal(status.observability_version, "test-mcp-observability-v1");
assert.equal(status.compatibility_label, CURRENT_COMPATIBILITY_LABEL);
assert.equal(status.stage, CURRENT_STAGE_STATUS);
assert.equal(status.read_only, true);
assert.equal(status.mutates_auth, false);
assert.equal(status.mutates_tools_list, false);
assert.equal(status.dynamic_import_enabled, false);
assert.equal(status.list_changed_enabled, false);
assert.equal(status.runtime.server_version, "0.40.0");
assert.equal(status.runtime.compatibility_label, CURRENT_COMPATIBILITY_LABEL);
assert.equal(status.runtime.enabled_tool_count, 3);
assert.equal(status.runtime.request_contract.route, "/mcp");
assert.equal(status.client_entry_path_diagnostics.request_contract.server_discover_supported, true);
assert.equal(typeof status.client_entry_path_diagnostics.current_window_counts.initialize_response_sent, "number");
assert.equal(typeof status.client_entry_path_diagnostics.current_window_counts.initialize_response_success, "number");
assert.equal(typeof status.client_entry_path_diagnostics.current_window_counts.initialize_response_error, "number");
assert.equal(typeof status.client_entry_path_diagnostics.current_window_counts.server_discover_response_sent, "number");
assert.equal(typeof status.client_entry_path_diagnostics.current_window_counts.server_discover_response_success, "number");
assert.equal(typeof status.client_entry_path_diagnostics.current_window_counts.server_discover_response_error, "number");
assert.equal(typeof status.client_entry_path_diagnostics.initialize_response_observed_for_current_start, "boolean");
assert.equal(typeof status.client_entry_path_diagnostics.server_discover_response_observed_for_current_start, "boolean");
assert.equal(typeof status.client_entry_path_diagnostics.followup_traffic_without_fresh_entry, "boolean");
assert.equal(status.connector_map.comparison_available, true);
assert.equal(status.connector_map.status, "drift_detected");
assert.deepEqual(status.connector_map.missing_in_connector, ["observability_status"]);
assert.equal(status.connector_map.refresh_recommended, true);
assert.equal(typeof status.audit_log.path_disclosed, "boolean");
assert.equal(status.audit_log.path_disclosed, false);
assert.equal(typeof status.events.counts, "object");
assert.equal(typeof status.audit_jsonl_health.parse_errors, "number");
assert.equal(typeof status.tool_call_balance.orphan_start_count, "number");
assert.equal(typeof status.tool_call_balance.self_observation_inflight_count, "number");
assert.equal(typeof status.audit_semantics.arg_summary_failure_count, "number");
assert.equal(typeof status.transport_runtime_signals.unknown_tool_count, "number");
assert.equal(typeof status.path_redaction_risk.raw_path_like_value_count, "number");
assert.ok(Array.isArray(status.recommended_actions));
assert.equal(typeof status.latency.overall.count, "number");
assert.ok(Array.isArray(status.latency.per_tool));
assert.equal(status.stream_break_diagnostics.direct_ui_stream_break_detection, false);
assert.equal(status.child_process_anomalies.instrumented_in_test_mcp_runtime, false);

const noConnector = buildObservabilityStatus({
  args: { window_size: 10 },
  runtimeStatusProvider: () => runtimeStatus,
  auditLogPath,
});
assert.equal(noConnector.connector_map.comparison_available, false);
assert.equal(noConnector.connector_map.status, "external_connector_tool_map_not_provided");

const tool = createObservabilityStatusTool({ runtimeStatusProvider: () => runtimeStatus, auditLogPath });
assert.equal(tool.name, "observability_status");
assert.equal(tool.descriptor.name, "observability_status");
assert.equal(tool.descriptor.annotations.readOnlyHint, true);
assert.equal(tool.descriptor.annotations.destructiveHint, false);
assert.equal(tool.descriptor.annotations.openWorldHint, false);
assert.equal(tool.descriptor.inputSchema.additionalProperties, false);

console.log("smoke_observability_status ok");
