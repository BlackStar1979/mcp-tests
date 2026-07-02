const assert = require("node:assert/strict");
const { CURRENT_STAGE_STATUS, CURRENT_COMPATIBILITY_LABEL } = require("../src/stage_metadata");
const path = require("node:path");
const { buildObservabilityStatus } = require("../src/observability_status");

const auditLogPath = path.join(__dirname, "fixtures", "observability_hardening_audit_fixture.jsonl");

const runtimeStatus = {
  server_version: "0.40.0",
  compatibility_label: CURRENT_COMPATIBILITY_LABEL,
  stage_status: CURRENT_STAGE_STATUS,
  auth: { mode: "none" },
  profile: { mode: "public" },
  enabled_tools: ["search", "fetch", "dev_code_symbols", "fs_read_public_text", "observability_status"],
  security_boundary: { status: "ok" },
};

const status = buildObservabilityStatus({
  args: {
    window_size: 100,
    slow_ms: 1000,
    top_n: 10,
    connector_visible_tools: ["search", "fetch", "dev_code_symbols", "fs_read_public_text", "observability_status"],
  },
  runtimeStatusProvider: () => runtimeStatus,
  auditLogPath,
});

assert.equal(status.success, true);
assert.equal(status.audit_jsonl_health.status, "ok");
assert.equal(status.audit_jsonl_health.window_checked, 12);
assert.equal(status.audit_jsonl_health.parse_errors, 1);
assert.equal(status.connector_map_health.status, "in_sync");
assert.equal(status.connector_map_health.refresh_recommended, false);
assert.equal(status.tool_call_balance.starts, 4);
assert.equal(status.tool_call_balance.ends, 3);
assert.equal(status.tool_call_balance.error_events, 1);
assert.equal(status.tool_call_balance.orphan_start_count, 1);
assert.equal(status.tool_call_balance.orphan_start_samples[0].tool, "dev_code_symbols");
assert.equal(status.tool_call_balance.self_observation_inflight_count, 0);
assert.equal(status.audit_semantics.success_false_markers, 1);
assert.equal(status.audit_semantics.arg_summary_failure_count, 1);
assert.equal(status.audit_semantics.execution_error_count, 0);
assert.match(status.audit_semantics.note, /audit metadata failure/);
assert.equal(status.transport_runtime_signals.auth_rejection_count, 1);
assert.equal(status.transport_runtime_signals.unknown_tool_count, 2);
assert.equal(status.transport_runtime_signals.method_not_allowed_count, 1);
assert.equal(status.transport_runtime_signals.port_conflict_count, 1);
assert.equal(status.transport_runtime_signals.server_error_count, 1);
assert.ok(status.transport_runtime_signals.unknown_tool_samples.length >= 1);
assert.ok(status.transport_runtime_signals.port_conflict_samples.length >= 1);
assert.ok(status.path_redaction_risk.raw_path_like_value_count >= 2);
assert.ok(status.path_redaction_risk.absolute_path_hint_count >= 1);
assert.ok(status.path_redaction_risk.sensitive_path_hint_count >= 1);
assert.equal(status.path_redaction_risk.samples[0].raw_path_redacted, true);
assert.equal(typeof status.path_redaction_risk.samples[0].value_sha256_prefix, "string");
assert.equal(status.slow_tool_summary.delayed_response_count, 1);
assert.equal(status.slow_tool_summary.top_tools[0].tool, "fs_read_public_text");
assert.equal(status.stream_break_diagnostics.indicators.orphan_tool_call_starts, 1);
assert.equal(status.stream_break_diagnostics.indicators.unknown_tools, 2);
assert.equal(status.stream_break_diagnostics.indicators.port_conflicts, 1);
assert.ok(status.recommended_actions.some((item) => item.includes("unknown_tool")));
assert.ok(status.recommended_actions.some((item) => item.includes("port 3009")));
assert.ok(status.recommended_actions.some((item) => item.includes("arg_summary")));
assert.ok(status.recommended_actions.some((item) => item.includes("raw audit logs")));
assert.deepEqual(status.next_recommended_checks, status.recommended_actions);

const serialized = JSON.stringify(status);
assert.equal(serialized.includes("C:/Work/mcp-tests/_fixtures/example.txt"), false);
assert.equal(serialized.includes("docs/private.pem"), false);
assert.equal(serialized.includes("listen EADDRINUSE"), false);

console.log("smoke_observability_hardening ok");
