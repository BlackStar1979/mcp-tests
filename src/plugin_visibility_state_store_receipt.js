const crypto = require("node:crypto");

const STATE_STORE_RECEIPT_VERSION = "test-mcp-plugin-visibility-state-store-receipt-v1";

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function asBool(value) {
  return value === true;
}

function buildStateStoreTransactionReceipt({ plan = {}, stage = "plugin-visibility-state-store-receipt", operation = "preview", operator = "", reason = "" } = {}) {
  const writePlan = plan.write_plan || {};
  const rollback = plan.rollback || {};
  const receipt = {
    version: STATE_STORE_RECEIPT_VERSION,
    stage: String(stage || ""),
    operation: String(operation || "preview"),
    tool_name: String(plan.tool_name || ""),
    current_state: String(plan.current_state || ""),
    target_state: String(plan.target_state || ""),
    plan_success: asBool(plan.success),
    would_change_state: asBool(plan.would_change_state),
    would_change_tools_list: asBool(plan.would_change_tools_list),
    would_require_list_changed: asBool(plan.would_require_list_changed),
    fs_write_enabled_now: asBool(plan.fs_write_enabled_now),
    execute_allowed_now: asBool(plan.execute_allowed_now),
    real_mutation_enabled: asBool(plan.real_mutation_enabled),
    list_changed_enabled_now: asBool(plan.list_changed_enabled_now),
    dynamic_import_enabled: asBool(plan.dynamic_import_enabled),
    proposed_record_hash: String(plan.proposed_record_hash || ""),
    proposed_store_hash: String(plan.proposed_store_hash || ""),
    write_plan_hash: hashJson({
      before_hash: writePlan.before_hash || "",
      after_hash: writePlan.after_hash || "",
      would_write: asBool(writePlan.would_write),
      atomic_write_required: asBool(writePlan.atomic_write_required),
      temp_file_required: asBool(writePlan.temp_file_required),
      backup_required: asBool(writePlan.backup_required),
      fs_write_enabled_now: asBool(writePlan.fs_write_enabled_now),
      execute_allowed_now: asBool(writePlan.execute_allowed_now),
      raw_path_redacted: writePlan.raw_path_redacted === true,
    }),
    before_hash: String(writePlan.before_hash || ""),
    after_hash: String(writePlan.after_hash || ""),
    would_write: asBool(writePlan.would_write),
    atomic_write_required: asBool(writePlan.atomic_write_required),
    rollback_hash: String(rollback.rollback_hash || ""),
    rollback_required_for_quarantine: asBool(rollback.rollback_required_for_quarantine),
    operator_recorded: Boolean(String(operator || "").trim()) || asBool(rollback.operator_recorded),
    reason_recorded: Boolean(String(reason || "").trim()) || asBool(rollback.reason_recorded),
    blocker_count: Array.isArray(plan.blockers) ? plan.blockers.length : 0,
    blockers_hash: hashJson(Array.isArray(plan.blockers) ? plan.blockers : []),
    warning_count: Array.isArray(plan.warnings) ? plan.warnings.length : 0,
    warnings_hash: hashJson(Array.isArray(plan.warnings) ? plan.warnings : []),
    required_approval_count: Array.isArray(plan.required_approvals) ? plan.required_approvals.length : 0,
    required_approvals_hash: hashJson(Array.isArray(plan.required_approvals) ? plan.required_approvals : []),
    raw_record_redacted: true,
    raw_store_redacted: true,
    raw_path_redacted: writePlan.raw_path_redacted === true,
    transaction_applied: false,
    fs_write_performed: false,
    list_changed_emitted: false,
    success: true,
  };
  return {
    ...receipt,
    receipt_hash: hashJson(receipt),
  };
}

function verifyStateStoreTransactionReceipt(receipt = {}) {
  const errors = [];
  if (receipt.version !== STATE_STORE_RECEIPT_VERSION) errors.push("unsupported receipt version");
  if (receipt.raw_record_redacted !== true) errors.push("raw record must be redacted");
  if (receipt.raw_store_redacted !== true) errors.push("raw store must be redacted");
  if (receipt.raw_path_redacted !== true) errors.push("raw path must be redacted");
  if (receipt.transaction_applied === true) errors.push("preview receipt must not record applied transaction");
  if (receipt.fs_write_performed === true) errors.push("preview receipt must not record fs write");
  if (receipt.list_changed_emitted === true) errors.push("preview receipt must not record list_changed emission");
  if (receipt.real_mutation_enabled === true) errors.push("real mutation must remain disabled");
  if (receipt.execute_allowed_now === true) errors.push("execute must remain disabled");
  if (receipt.fs_write_enabled_now === true) errors.push("fs write must remain disabled");
  if (receipt.dynamic_import_enabled === true) errors.push("dynamic import must remain disabled");
  if (receipt.would_write === true && receipt.atomic_write_required !== true) errors.push("would_write requires atomic_write_required");
  if (receipt.target_state === "quarantined" && receipt.rollback_required_for_quarantine !== true) errors.push("quarantine requires rollback receipt marker");
  if (!receipt.receipt_hash || typeof receipt.receipt_hash !== "string") errors.push("receipt_hash is required");

  const copy = { ...receipt };
  delete copy.receipt_hash;
  if (receipt.receipt_hash && receipt.receipt_hash !== hashJson(copy)) errors.push("receipt_hash mismatch");

  return {
    success: errors.length === 0,
    error: errors.join("; "),
    version: STATE_STORE_RECEIPT_VERSION,
    errors,
  };
}

module.exports = {
  STATE_STORE_RECEIPT_VERSION,
  buildStateStoreTransactionReceipt,
  verifyStateStoreTransactionReceipt,
};
