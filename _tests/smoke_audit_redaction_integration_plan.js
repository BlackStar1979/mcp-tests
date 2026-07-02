const assert = require("node:assert/strict");
const {
  AUDIT_REDACTION_INTEGRATION_PLAN_VERSION,
  buildAuditRedactionIntegrationPlan,
  verifyAuditRedactionIntegrationPlan,
} = require("../src/audit_redaction_integration_plan");

const riskyPayload = {
  audit: [
    { event: "tool_call_start", path: "C:/Work/mcp-tests/docs/private.pem" },
    { event: "tool_call_error", detail: "token file .secrets/mcp_token.txt" },
  ],
};

const plan = buildAuditRedactionIntegrationPlan({
  samplePayload: riskyPayload,
  target: "observability_status",
});
assert.equal(plan.success, true);
assert.equal(plan.integration_plan_version, AUDIT_REDACTION_INTEGRATION_PLAN_VERSION);
assert.equal(plan.mode, "audit-redaction-integration-planning-only");
assert.equal(plan.target, "observability_status");
assert.equal(plan.raw_export_allowed, false);
assert.equal(plan.raw_payload_redacted, true);
assert.equal(plan.raw_audit_log_mutation_enabled, false);
assert.equal(plan.new_public_tool_allowed_now, false);
assert.equal(plan.observability_output_schema_change_allowed_now, false);
assert.equal(plan.connector_refresh_required_now, false);
assert.equal(plan.runtime_restart_required_now, false);
assert.equal(plan.descriptor_change_allowed_now, false);
assert.equal(plan.schema_change_allowed_now, false);
assert.equal(plan.tool_surface_change_allowed_now, false);
assert.equal(plan.recommended_export_mode, "redacted_summary_only");
assert.equal(plan.before_export_safe, false);
assert.equal(plan.after_export_safe, true);
assert.ok(plan.before_risk_counts.raw_path_like_value_count >= 1);
assert.ok(plan.before_risk_counts.sensitive_path_hint_count >= 1);
assert.equal(plan.after_risk_counts.raw_path_like_value_count, 0);
assert.equal(plan.after_risk_counts.sensitive_path_hint_count, 0);
assert.ok(plan.blockers.includes("raw audit export remains forbidden"));
assert.ok(plan.blockers.includes("observability_status output schema must not be changed in the current planning package"));
assert.ok(plan.required_future_approvals.includes("manual connector refresh after any future schema or tool-surface change"));
assert.equal(verifyAuditRedactionIntegrationPlan(plan).success, true);

const separateToolPlan = buildAuditRedactionIntegrationPlan({
  samplePayload: riskyPayload,
  target: "future_audit_export_tool",
});
assert.equal(separateToolPlan.recommended_integration_mode, "separate-future-tool-only");
assert.equal(separateToolPlan.new_public_tool_allowed_now, false);
assert.equal(verifyAuditRedactionIntegrationPlan(separateToolPlan).success, true);

const tampered = { ...plan, raw_export_allowed: true };
const tamperedResult = verifyAuditRedactionIntegrationPlan(tampered);
assert.equal(tamperedResult.success, false);
assert.ok(tamperedResult.errors.includes("raw_export_allowed must be false"));
assert.ok(tamperedResult.errors.includes("plan_hash mismatch"));

const unsafe = { ...plan, after_export_safe: false };
const unsafeResult = verifyAuditRedactionIntegrationPlan(unsafe);
assert.equal(unsafeResult.success, false);
assert.ok(unsafeResult.errors.includes("redacted export must be safe after redaction"));

console.log("smoke_audit_redaction_integration_plan ok");
