"use strict";

const crypto = require("node:crypto");
const {
  OAUTH21_PRUNE_PREVIEW_VERSION,
} = require("./oauth21_prune_preview");
const {
  OAUTH21_PRUNE_RECEIPT_VERSION,
  verifyOAuth21PruneReceipt,
} = require("./oauth21_prune_receipt");
const {
  OAUTH21_PRUNE_APPLY_GATE_VERSION,
  verifyOAuth21PruneApplyReadiness,
} = require("./oauth21_prune_apply_gate");

const APPROVAL_MARKER_ID = "operator_approved_oauth21_prune_apply";

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function dedupeSequence(...lists) {
  const seen = new Set();
  const output = [];
  for (const list of lists) {
    for (const item of Array.isArray(list) ? list : []) {
      const value = String(item || "").trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      output.push(value);
    }
  }
  return Object.freeze(output);
}

const FUTURE_TEST_PLAN = Object.freeze([
  "missing approval marker keeps oauth21 prune apply disabled",
  "preview, receipt, and gate hashes stay stable for identical inputs",
  "explicit apply path requires fresh backup metadata before file mutation",
  "explicit apply path records rollback metadata before deleting any candidate",
  "explicit apply path never exposes raw client_ids or raw token strings in receipts",
  "explicit apply path updates post-apply runtime status and candidate counts",
  "explicit apply path preserves active grants and active clients",
  "full run_all --skip-network remains green after oauth21 prune control-plane wiring",
]);

function buildOAuth21PruneApplyPackageDraft({ preview = {}, receipt = {}, gate = {} } = {}) {
  if (!preview || !receipt || !gate) {
    throw new Error("buildOAuth21PruneApplyPackageDraft requires preview, receipt, and gate.");
  }

  const receiptVerification = verifyOAuth21PruneReceipt(receipt);
  const gateVerification = verifyOAuth21PruneApplyReadiness(gate);
  const approvalMarkerTemplate = Object.freeze({
    id: APPROVAL_MARKER_ID,
    approved: false,
    oauth21_prune_authorized: false,
    file_mutation_authorized: false,
    approved_by: "<operator>",
    approved_at: "<ISO-8601 timestamp>",
    note: "Template only; not an approval marker until explicitly completed and accepted by the operator.",
  });

  const packageCore = {
    schema_version: "oauth21-prune-apply-package-draft-v1",
    mode: "draft_only_no_apply",
    apply_allowed_now: false,
    oauth_state_file_mutated: false,
    oauth_clients_file_mutated: false,
    runtime_memory_mutated: false,
    audit_event_emitted_now: false,
    approval_marker_recorded: false,
    approval_marker_required: true,
    approval_marker_id: APPROVAL_MARKER_ID,
    approval_marker_template: approvalMarkerTemplate,
    preview_version: String(preview.version || ""),
    receipt_version: String(receipt.version || ""),
    gate_version: String(gate.gate_version || ""),
    preview_version_supported: preview.version === OAUTH21_PRUNE_PREVIEW_VERSION,
    receipt_version_supported: receipt.version === OAUTH21_PRUNE_RECEIPT_VERSION,
    gate_version_supported: gate.gate_version === OAUTH21_PRUNE_APPLY_GATE_VERSION,
    preview_hash: String(preview.preview_hash || ""),
    receipt_hash: String(receipt.receipt_hash || ""),
    gate_hash: String(gate.gate_hash || ""),
    preview_success: preview.success === true,
    receipt_verified: receiptVerification.success === true,
    gate_verified: gateVerification.success === true,
    future_ready_if_apply_enabled: gate.future_ready_if_apply_enabled === true,
    raw_identifiers_redacted: preview.raw_identifiers_redacted === true
      && receipt.raw_identifiers_redacted === true
      && gate.raw_payloads_included === false,
    backup_required_now: preview.backup_plan?.required === true,
    rollback_metadata_required_now: preview.rollback_metadata?.required === true,
    candidate_counts: Object.freeze({
      dead_clients_eligible: Number(preview.candidate_counts?.dead_clients_eligible || 0),
      dead_clients_deferred: Number(preview.candidate_counts?.dead_clients_deferred || 0),
      orphan_access_tokens: Number(preview.candidate_counts?.orphan_access_tokens || 0),
      orphan_refresh_tokens: Number(preview.candidate_counts?.orphan_refresh_tokens || 0),
      orphan_used_refresh_tokens: Number(preview.candidate_counts?.orphan_used_refresh_tokens || 0),
      total_candidates: Number(preview.candidate_counts?.total_candidates || 0),
    }),
    checks: Object.freeze({
      preview_success: preview.success === true,
      receipt_verified: receiptVerification.success === true,
      gate_verified: gateVerification.success === true,
      gate_apply_allowed_now_false: gate.apply_allowed_now === false,
      raw_identifiers_redacted: preview.raw_identifiers_redacted === true && receipt.raw_identifiers_redacted === true,
      backup_metadata_present: preview.backup_plan?.required === true,
      rollback_metadata_present: preview.rollback_metadata?.required === true,
    }),
    missing_requirements: Object.freeze(Array.isArray(gate.missing_requirements) ? [...gate.missing_requirements] : []),
    future_apply_sequence: dedupeSequence(
      preview.required_apply_sequence,
      gate.next_required_before_apply,
      [
        "record explicit operator approval marker for oauth21 prune apply",
        "capture post-apply oauth21 runtime status and compare candidate counts",
      ],
    ),
    future_test_plan: FUTURE_TEST_PLAN,
    stage_decisions: Object.freeze({
      runtime_restart_required_now: false,
      connector_refresh_required_now: false,
      deploy_required_now: false,
      backup_required_now: preview.backup_plan?.required === true,
      future_apply_requires_separate_controlled_operation: true,
      future_apply_control_plane_snapshot_deploy_rollback_required: true,
      future_apply_operator_approval_required: true,
      future_apply_connector_visible_schema_change_expected: false,
    }),
    non_actions: Object.freeze([
      "no oauth21 prune apply",
      "no oauth state file mutation",
      "no oauth clients file mutation",
      "no runtime memory mutation",
      "no approval marker recorded",
      "no audit event emitted for apply",
      "no server restart",
      "no connector refresh",
      "no deploy",
    ]),
  };

  return Object.freeze({
    ...packageCore,
    package_hash: hashJson(packageCore),
  });
}

module.exports = {
  APPROVAL_MARKER_ID,
  FUTURE_TEST_PLAN,
  buildOAuth21PruneApplyPackageDraft,
};
