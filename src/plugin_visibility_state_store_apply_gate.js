const crypto = require("node:crypto");

const STATE_STORE_APPLY_GATE_VERSION = "test-mcp-plugin-visibility-state-store-apply-gate-v1";

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function buildMissingItems(items = []) {
  return items.filter((item) => item.ok !== true).map((item) => item.name);
}

function evaluateStateStoreApplyReadiness({
  pipelineResult = {},
  operatorApproval = false,
  persistenceConfigured = false,
  rollbackConfigured = false,
  auditRedactionReady = false,
  connectorRefreshPlanReady = false,
  authProfileAllowed = false,
  forceApplyRequested = false,
} = {}) {
  const checks = [
    { name: "pipeline_success", ok: pipelineResult.success === true },
    { name: "state_receipt_verified", ok: pipelineResult.state_receipt_summary?.receipt_verified === true },
    { name: "list_changed_receipt_verified", ok: pipelineResult.list_changed_summary?.receipt_verified === true },
    { name: "raw_payloads_redacted", ok: pipelineResult.raw_payloads_redacted === true },
    { name: "operator_approval", ok: operatorApproval === true },
    { name: "persistence_configured", ok: persistenceConfigured === true },
    { name: "rollback_configured", ok: rollbackConfigured === true },
    { name: "audit_redaction_ready", ok: auditRedactionReady === true },
    { name: "connector_refresh_plan_ready", ok: connectorRefreshPlanReady === true },
    { name: "auth_profile_allowed", ok: authProfileAllowed === true },
  ];
  const missing = buildMissingItems(checks);
  const futureReady = missing.length === 0;

  const gate = {
    success: true,
    error: "",
    mode: "plugin-visibility-state-store-apply-readiness-gate",
    gate_version: STATE_STORE_APPLY_GATE_VERSION,
    future_ready_if_apply_enabled: futureReady,
    apply_allowed_now: false,
    force_apply_requested: forceApplyRequested === true,
    force_apply_honored: false,
    pipeline_success: pipelineResult.success === true,
    would_write: pipelineResult.state_store_summary?.would_write === true,
    would_change_tools_list: pipelineResult.tools_diff_summary?.would_change_tools_list === true,
    would_require_list_changed: pipelineResult.tools_diff_summary?.would_require_list_changed === true,
    state_receipt_verified: pipelineResult.state_receipt_summary?.receipt_verified === true,
    list_changed_receipt_verified: pipelineResult.list_changed_summary?.receipt_verified === true,
    raw_payloads_redacted: pipelineResult.raw_payloads_redacted === true,
    operator_approval: operatorApproval === true,
    persistence_configured: persistenceConfigured === true,
    rollback_configured: rollbackConfigured === true,
    audit_redaction_ready: auditRedactionReady === true,
    connector_refresh_plan_ready: connectorRefreshPlanReady === true,
    auth_profile_allowed: authProfileAllowed === true,
    missing_requirements: missing,
    denied_reasons: [
      "readiness-only gate; apply remains disabled",
      ...(forceApplyRequested === true ? ["force apply request ignored by readiness gate"] : []),
      ...missing.map((name) => `missing requirement: ${name}`),
    ],
    next_required_before_apply: [
      "explicit operator approval package",
      "durable state-store persistence configuration",
      "rollback/quarantine recovery test",
      "audit redaction summary/export decision",
      "connector refresh/list_changed operational plan",
      "auth/profile boundary decision",
    ],
    runtime_state_store_written: false,
    runtime_tools_list_mutated: false,
    client_notification_emitted: false,
    raw_store_redacted: true,
    raw_payloads_included: false,
  };

  return {
    ...gate,
    gate_hash: hashJson(gate),
  };
}

function verifyStateStoreApplyReadinessGate(gate = {}) {
  const errors = [];
  if (gate.gate_version !== STATE_STORE_APPLY_GATE_VERSION) errors.push("unsupported gate version");
  if (gate.apply_allowed_now !== false) errors.push("apply_allowed_now must remain false in readiness-only mode");
  if (gate.force_apply_honored !== false) errors.push("force_apply_honored must be false");
  if (gate.runtime_state_store_written !== false) errors.push("runtime_state_store_written must be false");
  if (gate.runtime_tools_list_mutated !== false) errors.push("runtime_tools_list_mutated must be false");
  if (gate.client_notification_emitted !== false) errors.push("client_notification_emitted must be false");
  if (gate.raw_store_redacted !== true) errors.push("raw_store_redacted must be true");
  if (gate.raw_payloads_included !== false) errors.push("raw_payloads_included must be false");
  if (!Array.isArray(gate.missing_requirements)) errors.push("missing_requirements must be an array");
  if (!Array.isArray(gate.denied_reasons)) errors.push("denied_reasons must be an array");
  if (!gate.denied_reasons?.includes("readiness-only gate; apply remains disabled")) errors.push("readiness-only denial is required");
  if (!gate.gate_hash || typeof gate.gate_hash !== "string") errors.push("gate_hash is required");

  const copy = { ...gate };
  delete copy.gate_hash;
  if (gate.gate_hash && gate.gate_hash !== hashJson(copy)) errors.push("gate_hash mismatch");

  return {
    success: errors.length === 0,
    error: errors.join("; "),
    version: STATE_STORE_APPLY_GATE_VERSION,
    errors,
  };
}

module.exports = {
  STATE_STORE_APPLY_GATE_VERSION,
  evaluateStateStoreApplyReadiness,
  verifyStateStoreApplyReadinessGate,
};
