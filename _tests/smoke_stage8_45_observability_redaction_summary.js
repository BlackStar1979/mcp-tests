const assert = require("node:assert/strict");
const {
  OBSERVABILITY_REDACTION_SUMMARY_VERSION,
  buildObservabilityRedactionSummary,
  verifyObservabilityRedactionSummary,
} = require("../src/observability_redaction_summary");

const riskyPayload = {
  audit_jsonl_health: { status: "ok" },
  examples: [
    { event: "tool_call_start", arg: "C:/Work/mcp-tests/docs/private.pem" },
    { event: "tool_call_error", message: "read .secrets/mcp_token.txt failed" },
    { event: "child_process", stderr: "/tmp/workspace/credential.key" },
  ],
};

const summary = buildObservabilityRedactionSummary({ auditLikePayload: riskyPayload, source: "observability_status" });
assert.equal(summary.success, true);
assert.equal(summary.summary_version, OBSERVABILITY_REDACTION_SUMMARY_VERSION);
assert.equal(summary.mode, "observability-redaction-summary-prototype");
assert.equal(summary.export_mode, "redacted_summary_only");
assert.equal(summary.raw_export_allowed, false);
assert.equal(summary.raw_payload_included, false);
assert.equal(summary.redacted_payload_included, false);
assert.equal(summary.before_export_safe, false);
assert.equal(summary.after_export_safe, true);
assert.ok(summary.before_risk_counts.raw_path_like_value_count >= 1);
assert.ok(summary.before_risk_counts.sensitive_path_hint_count >= 1);
assert.equal(summary.after_risk_counts.raw_path_like_value_count, 0);
assert.equal(summary.after_risk_counts.sensitive_path_hint_count, 0);
assert.ok(summary.redaction_counts.redacted_string_count >= 3);
assert.equal(summary.safety_decision, "safe_for_summary_export");
assert.equal(summary.observability_status_schema_changed, false);
assert.equal(summary.connector_visible_change, false);
assert.equal(summary.connector_refresh_required_now, false);
assert.equal(summary.runtime_restart_required_now, false);
assert.equal(summary.raw_audit_log_mutated, false);
assert.equal(summary.public_export_tool_added, false);
assert.deepEqual(summary.blockers, []);
assert.equal(verifyObservabilityRedactionSummary(summary).success, true);

const serialized = JSON.stringify(summary);
for (const forbidden of ["C:/Work", "private.pem", ".secrets", "mcp_token", "credential.key"]) {
  assert.equal(serialized.includes(forbidden), false, `summary leaked ${forbidden}`);
}
assert.equal(serialized.includes("redacted_payload"), true, "summary may mention redacted_payload flags/hash only");
assert.equal(Object.prototype.hasOwnProperty.call(summary, "redacted_payload"), false);
assert.equal(Object.prototype.hasOwnProperty.call(summary, "raw_payload"), false);

const safeSummary = buildObservabilityRedactionSummary({ auditLikePayload: { status: "ok", count: 1 } });
assert.equal(safeSummary.success, true);
assert.equal(safeSummary.before_export_safe, true);
assert.equal(safeSummary.after_export_safe, true);
assert.equal(safeSummary.redaction_counts.redacted_string_count, 0);
assert.equal(verifyObservabilityRedactionSummary(safeSummary).success, true);

const tampered = { ...summary, raw_export_allowed: true };
const tamperedResult = verifyObservabilityRedactionSummary(tampered);
assert.equal(tamperedResult.success, false);
assert.ok(tamperedResult.errors.includes("raw_export_allowed must be false"));
assert.ok(tamperedResult.errors.includes("summary_hash mismatch"));

const unsafe = { ...summary, after_export_safe: false };
const unsafeResult = verifyObservabilityRedactionSummary(unsafe);
assert.equal(unsafeResult.success, false);
assert.ok(unsafeResult.errors.includes("after_export_safe must be true"));

console.log("smoke_stage8_45_observability_redaction_summary ok");
