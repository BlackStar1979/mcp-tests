"use strict";

const crypto = require("node:crypto");

const OAUTH21_PRUNE_APPLY_GATE_VERSION = "test-mcp-oauth21-prune-apply-gate-v1";

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function evaluateOAuth21PruneApplyReadiness({
  preview = {},
  receipt = {},
  receiptVerified = false,
  operatorApproval = false,
  backupConfigured = false,
  rollbackConfigured = false,
  auditRedactionReady = false,
  maintenanceWindowReady = false,
  authProfileAllowed = false,
  forceApplyRequested = false,
} = {}) {
  const checks = [
    { name: "preview_success", ok: preview.success === true },
    { name: "receipt_verified", ok: receiptVerified === true },
    { name: "raw_identifiers_redacted", ok: preview.raw_identifiers_redacted === true && receipt.raw_identifiers_redacted === true },
    { name: "operator_approval", ok: operatorApproval === true },
    { name: "backup_configured", ok: backupConfigured === true },
    { name: "rollback_configured", ok: rollbackConfigured === true },
    { name: "audit_redaction_ready", ok: auditRedactionReady === true },
    { name: "maintenance_window_ready", ok: maintenanceWindowReady === true },
    { name: "auth_profile_allowed", ok: authProfileAllowed === true },
  ];

  const missing = checks.filter((item) => item.ok !== true).map((item) => item.name);
  const futureReady = missing.length === 0;

  const gate = {
    success: true,
    error: "",
    mode: "oauth21-prune-apply-readiness-gate",
    gate_version: OAUTH21_PRUNE_APPLY_GATE_VERSION,
    future_ready_if_apply_enabled: futureReady,
    apply_allowed_now: false,
    force_apply_requested: forceApplyRequested === true,
    force_apply_honored: false,
    preview_success: preview.success === true,
    receipt_verified: receiptVerified === true,
    total_candidates: Number(preview.candidate_counts?.total_candidates || 0),
    raw_identifiers_redacted: preview.raw_identifiers_redacted === true && receipt.raw_identifiers_redacted === true,
    operator_approval: operatorApproval === true,
    backup_configured: backupConfigured === true,
    rollback_configured: rollbackConfigured === true,
    audit_redaction_ready: auditRedactionReady === true,
    maintenance_window_ready: maintenanceWindowReady === true,
    auth_profile_allowed: authProfileAllowed === true,
    missing_requirements: missing,
    denied_reasons: [
      "readiness-only gate; apply remains disabled",
      ...(forceApplyRequested === true ? ["force apply request ignored by readiness gate"] : []),
      ...missing.map((name) => `missing requirement: ${name}`),
    ],
    next_required_before_apply: [
      "explicit operator approval package",
      "fresh backup for oauth state and clients files",
      "rollback metadata and restore drill",
      "audit redaction review/export decision",
      "maintenance window and reconnect plan",
      "auth/profile boundary confirmation",
    ],
    runtime_state_store_written: false,
    runtime_clients_store_written: false,
    runtime_tokens_store_written: false,
    raw_payloads_included: false,
  };

  return {
    ...gate,
    gate_hash: hashJson(gate),
  };
}

function verifyOAuth21PruneApplyReadiness(gate = {}) {
  const errors = [];
  if (gate.gate_version !== OAUTH21_PRUNE_APPLY_GATE_VERSION) errors.push("unsupported gate version");
  if (gate.apply_allowed_now !== false) errors.push("apply_allowed_now must remain false in readiness-only mode");
  if (gate.force_apply_honored !== false) errors.push("force_apply_honored must be false");
  if (gate.runtime_state_store_written !== false) errors.push("runtime_state_store_written must be false");
  if (gate.runtime_clients_store_written !== false) errors.push("runtime_clients_store_written must be false");
  if (gate.runtime_tokens_store_written !== false) errors.push("runtime_tokens_store_written must be false");
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
    version: OAUTH21_PRUNE_APPLY_GATE_VERSION,
    errors,
  };
}

module.exports = {
  OAUTH21_PRUNE_APPLY_GATE_VERSION,
  evaluateOAuth21PruneApplyReadiness,
  verifyOAuth21PruneApplyReadiness,
};
