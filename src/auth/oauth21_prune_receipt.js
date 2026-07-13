"use strict";

const crypto = require("node:crypto");
const { OAUTH21_PRUNE_PREVIEW_VERSION } = require("./oauth21_prune_preview");

const OAUTH21_PRUNE_RECEIPT_VERSION = "test-mcp-oauth21-prune-receipt-v1";

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function buildOAuth21PruneReceipt({ preview = {}, stage = "oauth21-prune-receipt", operation = "preview", operator = "", reason = "" } = {}) {
  const receipt = {
    version: OAUTH21_PRUNE_RECEIPT_VERSION,
    preview_version: String(preview.version || ""),
    stage: String(stage || ""),
    operation: String(operation || "preview"),
    preview_success: preview.success === true,
    candidate_counts_hash: hashJson(preview.candidate_counts || {}),
    sample_candidates_hash: hashJson(preview.sample_candidates || {}),
    preview_hash: String(preview.preview_hash || ""),
    total_candidates: Number(preview.candidate_counts?.total_candidates || 0),
    execute_allowed_now: preview.execute_allowed_now === true,
    fs_write_enabled_now: preview.fs_write_enabled_now === true,
    raw_identifiers_redacted: preview.raw_identifiers_redacted === true,
    backup_required: preview.backup_plan?.required === true,
    rollback_required: preview.rollback_metadata?.required === true,
    oauth_state_file_recorded: preview.backup_plan?.oauth_state_file_recorded === true,
    oauth_clients_file_recorded: preview.backup_plan?.oauth_clients_file_recorded === true,
    raw_paths_redacted: preview.backup_plan?.raw_paths_redacted === true,
    operator_recorded: Boolean(String(operator || "").trim()),
    reason_recorded: Boolean(String(reason || "").trim()),
    transaction_applied: false,
    fs_write_performed: false,
    oauth_state_file_mutated: false,
    oauth_clients_file_mutated: false,
    success: true,
  };

  return {
    ...receipt,
    receipt_hash: hashJson(receipt),
  };
}

function verifyOAuth21PruneReceipt(receipt = {}) {
  const errors = [];
  if (receipt.version !== OAUTH21_PRUNE_RECEIPT_VERSION) errors.push("unsupported receipt version");
  if (receipt.preview_version !== OAUTH21_PRUNE_PREVIEW_VERSION) errors.push("unsupported preview version");
  if (receipt.preview_success !== true) errors.push("preview_success must be true");
  if (receipt.raw_identifiers_redacted !== true) errors.push("raw identifiers must be redacted");
  if (receipt.raw_paths_redacted !== true) errors.push("raw paths must be redacted");
  if (receipt.execute_allowed_now === true) errors.push("execute must remain disabled");
  if (receipt.fs_write_enabled_now === true) errors.push("fs write must remain disabled");
  if (receipt.transaction_applied === true) errors.push("preview receipt must not record applied transaction");
  if (receipt.fs_write_performed === true) errors.push("preview receipt must not record fs write");
  if (receipt.oauth_state_file_mutated === true) errors.push("preview receipt must not mutate oauth state file");
  if (receipt.oauth_clients_file_mutated === true) errors.push("preview receipt must not mutate oauth clients file");
  if (!receipt.receipt_hash || typeof receipt.receipt_hash !== "string") errors.push("receipt_hash is required");

  const copy = { ...receipt };
  delete copy.receipt_hash;
  if (receipt.receipt_hash && receipt.receipt_hash !== hashJson(copy)) errors.push("receipt_hash mismatch");

  return {
    success: errors.length === 0,
    error: errors.join("; "),
    version: OAUTH21_PRUNE_RECEIPT_VERSION,
    errors,
  };
}

module.exports = {
  OAUTH21_PRUNE_RECEIPT_VERSION,
  buildOAuth21PruneReceipt,
  verifyOAuth21PruneReceipt,
};
