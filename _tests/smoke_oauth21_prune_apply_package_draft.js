"use strict";

const assert = require("node:assert/strict");
const {
  buildOAuth21PrunePreview,
} = require("../src/auth/oauth21_prune_preview");
const {
  buildOAuth21PruneReceipt,
} = require("../src/auth/oauth21_prune_receipt");
const {
  evaluateOAuth21PruneApplyReadiness,
} = require("../src/auth/oauth21_prune_apply_gate");
const {
  APPROVAL_MARKER_ID,
  FUTURE_TEST_PLAN,
  buildOAuth21PruneApplyPackageDraft,
} = require("../src/auth/oauth21_prune_apply_package_draft");

const nowMs = Date.parse("2026-07-12T12:00:00.000Z");
const deadClientMinAgeMs = 14 * 86400 * 1000;
const clients = new Map([
  ["active-client", { client_id: "active-client", client_id_issued_at: Math.floor((nowMs - (2 * 86400 * 1000)) / 1000) }],
  ["dead-old", { client_id: "dead-old", client_id_issued_at: Math.floor((nowMs - (15 * 86400 * 1000)) / 1000) }],
]);
const accessTokens = new Map([
  ["access-live", { token: "access-live", clientId: "active-client", grantId: "grant-live" }],
  ["access-orphan", { token: "access-orphan", clientId: "missing-client", grantId: "grant-orphan-a" }],
]);
const refreshTokens = new Map();
const usedRefreshTokens = new Map();
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
const receipt = buildOAuth21PruneReceipt({
  preview,
  operator: "operator",
  reason: "draft oauth21 prune package",
});
const gate = evaluateOAuth21PruneApplyReadiness({
  preview,
  receipt,
  receiptVerified: true,
  operatorApproval: true,
  backupConfigured: true,
  rollbackConfigured: true,
  auditRedactionReady: true,
  maintenanceWindowReady: true,
  authProfileAllowed: true,
});

const draft = buildOAuth21PruneApplyPackageDraft({ preview, receipt, gate });
assert.equal(APPROVAL_MARKER_ID, "operator_approved_oauth21_prune_apply");
assert.equal(draft.schema_version, "oauth21-prune-apply-package-draft-v1");
assert.equal(draft.mode, "draft_only_no_apply");
assert.equal(draft.apply_allowed_now, false);
assert.equal(draft.oauth_state_file_mutated, false);
assert.equal(draft.oauth_clients_file_mutated, false);
assert.equal(draft.runtime_memory_mutated, false);
assert.equal(draft.audit_event_emitted_now, false);
assert.equal(draft.approval_marker_recorded, false);
assert.equal(draft.approval_marker_required, true);
assert.equal(draft.approval_marker_id, APPROVAL_MARKER_ID);
assert.equal(draft.approval_marker_template.approved, false);
assert.equal(draft.approval_marker_template.oauth21_prune_authorized, false);
assert.equal(draft.approval_marker_template.file_mutation_authorized, false);
assert.equal(draft.preview_success, true);
assert.equal(draft.receipt_verified, true);
assert.equal(draft.gate_verified, true);
assert.equal(draft.future_ready_if_apply_enabled, true);
assert.equal(draft.raw_identifiers_redacted, true);
assert.equal(draft.backup_required_now, true);
assert.equal(draft.rollback_metadata_required_now, true);
assert.equal(draft.candidate_counts.dead_clients_eligible, 1);
assert.equal(draft.candidate_counts.orphan_access_tokens, 1);
assert.equal(draft.candidate_counts.total_candidates, 2);
assert.equal(draft.checks.preview_success, true);
assert.equal(draft.checks.receipt_verified, true);
assert.equal(draft.checks.gate_verified, true);
assert.equal(draft.stage_decisions.runtime_restart_required_now, false);
assert.equal(draft.stage_decisions.connector_refresh_required_now, false);
assert.equal(draft.stage_decisions.deploy_required_now, false);
assert.equal(draft.stage_decisions.future_apply_requires_separate_controlled_operation, true);
assert.equal(draft.stage_decisions.future_apply_control_plane_snapshot_deploy_rollback_required, true);
assert.equal(draft.stage_decisions.future_apply_connector_visible_schema_change_expected, false);
assert.ok(draft.future_apply_sequence.includes("record explicit operator approval marker for oauth21 prune apply"));
assert.ok(draft.future_apply_sequence.includes("capture post-apply oauth21 runtime status and compare candidate counts"));
assert.ok(FUTURE_TEST_PLAN.includes("explicit apply path records rollback metadata before deleting any candidate"));
assert.ok(draft.non_actions.includes("no oauth21 prune apply"));
assert.ok(typeof draft.package_hash === "string");

const secondDraft = buildOAuth21PruneApplyPackageDraft({ preview, receipt, gate });
assert.equal(secondDraft.package_hash, draft.package_hash);

console.log("smoke_oauth21_prune_apply_package_draft ok");
