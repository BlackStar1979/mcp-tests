const assert = require("node:assert/strict");
const {
  OAUTH21_PRUNE_PREVIEW_VERSION,
  buildOAuth21PrunePreview,
} = require("../src/auth/oauth21_prune_preview");
const {
  OAUTH21_PRUNE_RECEIPT_VERSION,
  buildOAuth21PruneReceipt,
  verifyOAuth21PruneReceipt,
} = require("../src/auth/oauth21_prune_receipt");
const {
  OAUTH21_PRUNE_APPLY_GATE_VERSION,
  evaluateOAuth21PruneApplyReadiness,
  verifyOAuth21PruneApplyReadiness,
} = require("../src/auth/oauth21_prune_apply_gate");

const nowMs = Date.parse("2026-07-12T12:00:00.000Z");
const deadClientMinAgeMs = 14 * 86400 * 1000;
const clients = new Map([
  ["active-client", { client_id: "active-client", client_id_issued_at: Math.floor((nowMs - (2 * 86400 * 1000)) / 1000) }],
  ["dead-old", { client_id: "dead-old", client_id_issued_at: Math.floor((nowMs - (15 * 86400 * 1000)) / 1000) }],
  ["dead-young", { client_id: "dead-young", client_id_issued_at: Math.floor((nowMs - (3 * 86400 * 1000)) / 1000) }],
]);
const accessTokens = new Map([
  ["access-live", { token: "access-live", clientId: "active-client", grantId: "grant-live" }],
  ["access-orphan", { token: "access-orphan", clientId: "missing-client", grantId: "grant-orphan-a" }],
]);
const refreshTokens = new Map([
  ["refresh-live", { token: "refresh-live", clientId: "active-client", grantId: "grant-live" }],
  ["refresh-orphan", { token: "refresh-orphan", clientId: "missing-client", grantId: "grant-orphan-r" }],
]);
const usedRefreshTokens = new Map([
  ["used-orphan", { token: "used-orphan", clientId: "missing-client", grantId: "grant-orphan-u" }],
]);
const pending = new Map();
const codes = new Map();

const preview = buildOAuth21PrunePreview({
  clients,
  accessTokens,
  refreshTokens,
  usedRefreshTokens,
  pending,
  codes,
  nowMs,
  deadClientMinAgeMs,
  oauthStatePath: "C:/secret/tests_oauth_state.json",
  clientsPath: "C:/secret/tests_oauth_clients.json",
});
assert.equal(preview.version, OAUTH21_PRUNE_PREVIEW_VERSION);
assert.equal(preview.success, true);
assert.equal(preview.execute_allowed_now, false);
assert.equal(preview.fs_write_enabled_now, false);
assert.equal(preview.raw_identifiers_redacted, true);
assert.equal(preview.candidate_counts.dead_clients_eligible, 1);
assert.equal(preview.candidate_counts.dead_clients_deferred, 1);
assert.equal(preview.candidate_counts.orphan_access_tokens, 1);
assert.equal(preview.candidate_counts.orphan_refresh_tokens, 1);
assert.equal(preview.candidate_counts.orphan_used_refresh_tokens, 1);
assert.equal(preview.candidate_counts.total_candidates, 4);
assert.equal(preview.sample_candidates.dead_clients_eligible[0].client_id_hash.length, 12);
assert.equal(preview.sample_candidates.orphan_access_tokens[0].token_hash.length, 12);
assert.equal(preview.backup_plan.required, true);
assert.equal(preview.backup_plan.raw_paths_redacted, true);
assert.equal(preview.backup_plan.oauth_state_file_recorded, true);
assert.equal(preview.backup_plan.oauth_clients_file_recorded, true);
assert.equal(preview.rollback_metadata.required, true);
assert.ok(preview.required_apply_sequence.includes("record prune receipt and rollback metadata"));
assert.equal(typeof preview.preview_hash, "string");

const receipt = buildOAuth21PruneReceipt({
  preview,
  stage: "oauth21-prune-preview-receipt",
  operation: "preview",
  operator: "operator",
  reason: "review oauth debt",
});
assert.equal(receipt.version, OAUTH21_PRUNE_RECEIPT_VERSION);
assert.equal(receipt.preview_version, OAUTH21_PRUNE_PREVIEW_VERSION);
assert.equal(receipt.preview_success, true);
assert.equal(receipt.execute_allowed_now, false);
assert.equal(receipt.fs_write_enabled_now, false);
assert.equal(receipt.raw_identifiers_redacted, true);
assert.equal(receipt.raw_paths_redacted, true);
assert.equal(receipt.backup_required, true);
assert.equal(receipt.rollback_required, true);
assert.equal(receipt.oauth_state_file_recorded, true);
assert.equal(receipt.oauth_clients_file_recorded, true);
assert.equal(receipt.transaction_applied, false);
assert.equal(receipt.fs_write_performed, false);
assert.equal(receipt.oauth_state_file_mutated, false);
assert.equal(receipt.oauth_clients_file_mutated, false);
assert.equal(receipt.operator_recorded, true);
assert.equal(receipt.reason_recorded, true);
assert.equal(typeof receipt.receipt_hash, "string");

const verifiedReceipt = verifyOAuth21PruneReceipt(receipt);
assert.equal(verifiedReceipt.success, true);

const badReceipt = { ...receipt, execute_allowed_now: true };
const badReceiptVerification = verifyOAuth21PruneReceipt(badReceipt);
assert.equal(badReceiptVerification.success, false);
assert.ok(badReceiptVerification.errors.includes("execute must remain disabled"));

const deniedGate = evaluateOAuth21PruneApplyReadiness({
  preview,
  receipt,
  receiptVerified: verifiedReceipt.success,
});
assert.equal(deniedGate.gate_version, OAUTH21_PRUNE_APPLY_GATE_VERSION);
assert.equal(deniedGate.apply_allowed_now, false);
assert.equal(deniedGate.future_ready_if_apply_enabled, false);
assert.ok(deniedGate.missing_requirements.includes("operator_approval"));
assert.ok(deniedGate.denied_reasons.includes("readiness-only gate; apply remains disabled"));

const readyGate = evaluateOAuth21PruneApplyReadiness({
  preview,
  receipt,
  receiptVerified: verifiedReceipt.success,
  operatorApproval: true,
  backupConfigured: true,
  rollbackConfigured: true,
  auditRedactionReady: true,
  maintenanceWindowReady: true,
  authProfileAllowed: true,
  forceApplyRequested: true,
});
assert.equal(readyGate.gate_version, OAUTH21_PRUNE_APPLY_GATE_VERSION);
assert.equal(readyGate.future_ready_if_apply_enabled, true);
assert.equal(readyGate.apply_allowed_now, false);
assert.equal(readyGate.force_apply_honored, false);
assert.equal(readyGate.runtime_state_store_written, false);
assert.equal(readyGate.runtime_clients_store_written, false);
assert.equal(readyGate.runtime_tokens_store_written, false);
assert.equal(readyGate.raw_payloads_included, false);

const verifiedGate = verifyOAuth21PruneApplyReadiness(readyGate);
assert.equal(verifiedGate.success, true);

const badGate = { ...readyGate, apply_allowed_now: true };
const badGateVerification = verifyOAuth21PruneApplyReadiness(badGate);
assert.equal(badGateVerification.success, false);
assert.ok(badGateVerification.errors.includes("apply_allowed_now must remain false in readiness-only mode"));

console.log("smoke_oauth21_prune_control_plane ok");
