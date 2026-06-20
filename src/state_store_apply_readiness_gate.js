const crypto = require("node:crypto");

const STATE_STORE_APPLY_READINESS_GATE_VERSION = "test-mcp-state-store-apply-readiness-gate-v1";

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function bool(value) {
  return value === true;
}

function hasNoRuntimeSideEffects(pipeline = {}) {
  return pipeline.runtime_transport_used === false
    && pipeline.runtime_tools_list_mutated === false
    && pipeline.runtime_state_store_written === false
    && pipeline.client_notification_emitted === false;
}

function evaluateStateStoreApplyReadiness({ pipeline = {}, approvals = {}, environment = {} } = {}) {
  const state = pipeline.state_store_summary || {};
  const diff = pipeline.tools_diff_summary || {};
  const listChanged = pipeline.list_changed_summary || {};
  const stateReceipt = pipeline.state_receipt_summary || {};

  const checks = {
    pipeline_success: bool(pipeline.success),
    state_store_summary_success: bool(state.success),
    state_receipt_verified: bool(stateReceipt.receipt_verified),
    list_changed_receipt_verified: bool(listChanged.receipt_verified),
    no_runtime_side_effects: hasNoRuntimeSideEffects(pipeline),
    no_effective_emit: pipeline.allow_emit_effective === false,
    no_effective_fs_write: pipeline.allow_fs_write_effective === false,
    raw_payloads_redacted: pipeline.raw_payloads_redacted === true,
    proposed_state_would_write: bool(state.would_write),
    tools_list_diff_known: Number.isFinite(Number(diff.change_count || 0)),
    explicit_operator_approval: approvals.explicit_operator_approval === true,
    rollback_plan_approved: approvals.rollback_plan_approved === true,
    redacted_audit_summary_available: approvals.redacted_audit_summary_available === true,
    connector_refresh_plan_approved: approvals.connector_refresh_plan_approved === true,
    internal_profile_confirmed: environment.internal_profile_confirmed === true,
    auth_not_none: environment.auth_mode && environment.auth_mode !== "none",
    maintenance_window_confirmed: environment.maintenance_window_confirmed === true,
  };

  const missing = [];
  for (const [name, ok] of Object.entries(checks)) {
    if (!ok) missing.push(name);
  }

  const futureReadyIfPolicyAllowed = missing.length === 0;
  const applyAllowedNow = false;

  const gate = {
    success: true,
    error: "",
    mode: "state-store-apply-readiness-gate-deny-by-default",
    gate_version: STATE_STORE_APPLY_READINESS_GATE_VERSION,
    pipeline_mode: pipeline.mode || "",
    pipeline_version: pipeline.pipeline_version || "",
    tool_name: pipeline.tool_name || "",
    target_state: pipeline.target_state || "",
    future_ready_if_policy_allowed: futureReadyIfPolicyAllowed,
    apply_allowed_now: applyAllowedNow,
    fs_write_allowed_now: false,
    list_changed_allowed_now: false,
    tools_list_mutation_allowed_now: false,
    dynamic_import_allowed_now: false,
    runtime_transport_allowed_now: false,
    connector_refresh_required_now: false,
    restart_required_now: false,
    checks,
    missing_requirements: missing,
    denial_reasons: [
      "Stage 8 / Step 46 is an apply-readiness gate only",
      "real state-store writes remain disabled",
      "tools/list mutation remains disabled",
      "notifications/tools/list_changed remains disabled",
    ],
    future_required_sequence: [
      "operator approves explicit apply stage",
      "auth/internal profile gate passes",
      "redacted audit summary is available",
      "rollback plan is approved",
      "state-store write is performed atomically in a separate apply stage",
      "tools/list mutation and list_changed are handled only after connector-refresh plan approval",
    ],
    raw_payloads_redacted: true,
  };

  return {
    ...gate,
    gate_hash: hashJson(gate),
  };
}

function verifyStateStoreApplyReadinessGate(gate = {}) {
  const errors = [];
  if (gate.gate_version !== STATE_STORE_APPLY_READINESS_GATE_VERSION) errors.push("unsupported gate version");
  if (gate.apply_allowed_now !== false) errors.push("apply_allowed_now must be false");
  if (gate.fs_write_allowed_now !== false) errors.push("fs_write_allowed_now must be false");
  if (gate.list_changed_allowed_now !== false) errors.push("list_changed_allowed_now must be false");
  if (gate.tools_list_mutation_allowed_now !== false) errors.push("tools_list_mutation_allowed_now must be false");
  if (gate.dynamic_import_allowed_now !== false) errors.push("dynamic_import_allowed_now must be false");
  if (gate.runtime_transport_allowed_now !== false) errors.push("runtime_transport_allowed_now must be false");
  if (gate.connector_refresh_required_now !== false) errors.push("connector_refresh_required_now must be false");
  if (gate.restart_required_now !== false) errors.push("restart_required_now must be false");
  if (gate.raw_payloads_redacted !== true) errors.push("raw_payloads_redacted must be true");
  if (!Array.isArray(gate.denial_reasons) || gate.denial_reasons.length === 0) errors.push("denial_reasons are required");
  if (!Array.isArray(gate.future_required_sequence) || gate.future_required_sequence.length === 0) errors.push("future_required_sequence is required");
  if (!gate.gate_hash || typeof gate.gate_hash !== "string") errors.push("gate_hash is required");

  const copy = { ...gate };
  delete copy.gate_hash;
  if (gate.gate_hash && gate.gate_hash !== hashJson(copy)) errors.push("gate_hash mismatch");

  return {
    success: errors.length === 0,
    error: errors.join("; "),
    version: STATE_STORE_APPLY_READINESS_GATE_VERSION,
    errors,
  };
}

module.exports = {
  STATE_STORE_APPLY_READINESS_GATE_VERSION,
  evaluateStateStoreApplyReadiness,
  verifyStateStoreApplyReadinessGate,
};
