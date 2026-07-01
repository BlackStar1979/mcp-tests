const crypto = require("node:crypto");
const { buildRedactedAuditExport } = require("./audit_export_redactor");

const AUDIT_REDACTION_INTEGRATION_PLAN_VERSION = "test-mcp-audit-redaction-integration-plan-v1";

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function buildAuditRedactionIntegrationPlan({ samplePayload = {}, target = "observability_status", mode = "planning" } = {}) {
  const redacted = buildRedactedAuditExport(samplePayload);
  const targetName = String(target || "observability_status");
  const isObservability = targetName === "observability_status";

  const plan = {
    success: true,
    error: "",
    mode: "audit-redaction-integration-planning-only",
    integration_plan_version: AUDIT_REDACTION_INTEGRATION_PLAN_VERSION,
    target: targetName,
    requested_mode: String(mode || "planning"),
    redactor_version: redacted.redactor_version,
    redacted_export_success: redacted.success === true,
    raw_export_allowed: false,
    raw_payload_redacted: true,
    raw_audit_log_mutation_enabled: false,
    new_public_tool_allowed_now: false,
    observability_output_schema_change_allowed_now: false,
    connector_refresh_required_now: false,
    runtime_restart_required_now: false,
    descriptor_change_allowed_now: false,
    schema_change_allowed_now: false,
    tool_surface_change_allowed_now: false,
    recommended_integration_mode: isObservability ? "additive-internal-helper-or-separate-future-tool" : "separate-future-tool-only",
    recommended_export_mode: "redacted_summary_only",
    redacted_payload_hash: redacted.redacted_payload_hash,
    before_export_safe: redacted.before_safety?.export_safe === true,
    after_export_safe: redacted.after_safety?.export_safe === true,
    before_risk_counts: {
      raw_path_like_value_count: redacted.before_safety?.raw_path_like_value_count || 0,
      sensitive_path_hint_count: redacted.before_safety?.sensitive_path_hint_count || 0,
      absolute_path_hint_count: redacted.before_safety?.absolute_path_hint_count || 0,
      relative_path_hint_count: redacted.before_safety?.relative_path_hint_count || 0,
    },
    after_risk_counts: {
      raw_path_like_value_count: redacted.after_safety?.raw_path_like_value_count || 0,
      sensitive_path_hint_count: redacted.after_safety?.sensitive_path_hint_count || 0,
      absolute_path_hint_count: redacted.after_safety?.absolute_path_hint_count || 0,
      relative_path_hint_count: redacted.after_safety?.relative_path_hint_count || 0,
    },
    redaction_stats: redacted.redaction_stats,
    plan_steps: [
      "keep raw audit logs local-only",
      "generate redacted summary with audit_export_redactor",
      "validate after_safety.export_safe before sharing",
      "avoid changing observability_status outputSchema without explicit compatibility package",
      "if public export is needed, add separate tool with strict outputSchema and connector refresh plan",
    ],
    blockers: [
      "raw audit export remains forbidden",
      "observability_status output schema must not be changed in the current planning package",
      "no connector-visible export tool exists in the current planning package",
    ],
    required_future_approvals: [
      "explicit compatibility package for observability_status output schema change, if needed",
      "explicit compatibility package for new connector-visible audit export tool, if needed",
      "manual connector refresh after any future schema or tool-surface change",
    ],
  };

  return {
    ...plan,
    plan_hash: hashJson(plan),
  };
}

function verifyAuditRedactionIntegrationPlan(plan = {}) {
  const errors = [];
  if (plan.integration_plan_version !== AUDIT_REDACTION_INTEGRATION_PLAN_VERSION) errors.push("unsupported plan version");
  if (plan.raw_export_allowed !== false) errors.push("raw_export_allowed must be false");
  if (plan.raw_payload_redacted !== true) errors.push("raw_payload_redacted must be true");
  if (plan.raw_audit_log_mutation_enabled !== false) errors.push("raw audit log mutation must remain disabled");
  if (plan.new_public_tool_allowed_now !== false) errors.push("new public tool must not be allowed now");
  if (plan.observability_output_schema_change_allowed_now !== false) errors.push("observability output schema change must not be allowed now");
  if (plan.connector_refresh_required_now !== false) errors.push("connector refresh must not be required now");
  if (plan.descriptor_change_allowed_now !== false) errors.push("descriptor change must not be allowed now");
  if (plan.schema_change_allowed_now !== false) errors.push("schema change must not be allowed now");
  if (plan.tool_surface_change_allowed_now !== false) errors.push("tool surface change must not be allowed now");
  if (plan.after_export_safe !== true) errors.push("redacted export must be safe after redaction");
  if (!plan.plan_hash || typeof plan.plan_hash !== "string") errors.push("plan_hash is required");

  const copy = { ...plan };
  delete copy.plan_hash;
  if (plan.plan_hash && plan.plan_hash !== hashJson(copy)) errors.push("plan_hash mismatch");

  return {
    success: errors.length === 0,
    error: errors.join("; "),
    version: AUDIT_REDACTION_INTEGRATION_PLAN_VERSION,
    errors,
  };
}

module.exports = {
  AUDIT_REDACTION_INTEGRATION_PLAN_VERSION,
  buildAuditRedactionIntegrationPlan,
  verifyAuditRedactionIntegrationPlan,
};
