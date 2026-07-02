const { planPluginVisibility } = require("./plugin_visibility");
const { planToolsListDiffForVisibilityPlan } = require("./tools_list_diff");
const { runListChangedHarness } = require("./list_changed_harness");
const { buildListChangedAuditReceipt, verifyListChangedAuditReceipt } = require("./list_changed_audit_receipt");
const { planPersistentVisibilityStateChange } = require("./plugin_visibility_state_store_preview");
const { buildStateStoreTransactionReceipt, verifyStateStoreTransactionReceipt } = require("./plugin_visibility_state_store_receipt");

const STATE_STORE_PIPELINE_VERSION = "test-mcp-plugin-visibility-state-store-pipeline-v1";

async function runPluginVisibilityStateStorePipeline({
  currentTools = [],
  currentStore = {},
  toolName = "",
  targetState = "enabled",
  operator = "",
  reason = "",
  now = "",
  stateStorePath = "",
  capabilities = { tools: { listChanged: false } },
  correlationId = "",
  allowEmitRequested = false,
  allowFsWriteRequested = false,
} = {}) {
  const visibilityPlan = await planPluginVisibility({
    tool_name: String(toolName || ""),
    target_state: String(targetState || ""),
    state_store: currentStore,
  });
  const statePlan = planPersistentVisibilityStateChange({
    currentStore,
    toolName,
    targetState,
    operator,
    reason,
    now,
    stateStorePath,
  });
  const toolsDiff = planToolsListDiffForVisibilityPlan({ current: currentTools, plan: visibilityPlan });

  const allowEmitEffective = false;
  const allowFsWriteEffective = false;
  const listChangedHarness = runListChangedHarness({
    diff: toolsDiff,
    capabilities,
    allowEmit: allowEmitEffective,
    reason,
    correlationId,
  });
  const listChangedReceipt = buildListChangedAuditReceipt({
    harnessResult: listChangedHarness,
    stage: "plugin-visibility-state-store-pipeline-dry-run",
    operation: "state_store_pipeline_dry_run",
    operator,
    reason,
  });
  const listChangedReceiptVerification = verifyListChangedAuditReceipt(listChangedReceipt);

  const stateReceipt = buildStateStoreTransactionReceipt({
    plan: statePlan,
    stage: "plugin-visibility-state-store-pipeline-dry-run",
    operation: "state_store_pipeline_dry_run",
    operator,
    reason,
  });
  const stateReceiptVerification = verifyStateStoreTransactionReceipt(stateReceipt);

  const success = visibilityPlan.success === true
    && statePlan.success === true
    && toolsDiff.success === true
    && listChangedHarness.success === true
    && listChangedReceiptVerification.success === true
    && stateReceiptVerification.success === true;

  return {
    success,
    error: success ? "" : [
      visibilityPlan.error || "",
      statePlan.error || "",
      listChangedReceiptVerification.error || "",
      stateReceiptVerification.error || "",
    ].filter(Boolean).join("; "),
    mode: "plugin-visibility-state-store-pipeline-dry-run",
    pipeline_version: STATE_STORE_PIPELINE_VERSION,
    allow_emit_requested: allowEmitRequested === true,
    allow_emit_effective: allowEmitEffective,
    allow_fs_write_requested: allowFsWriteRequested === true,
    allow_fs_write_effective: allowFsWriteEffective,
    tool_name: visibilityPlan.tool_name || String(toolName || ""),
    target_state: visibilityPlan.target_state || String(targetState || ""),
    visibility_summary: {
      success: visibilityPlan.success === true,
      current_state: visibilityPlan.current_state,
      target_state: visibilityPlan.target_state,
      would_change_tools_list: visibilityPlan.would_change_tools_list === true,
      would_require_list_changed: visibilityPlan.would_require_list_changed === true,
      execute_allowed_now: visibilityPlan.execute_allowed_now === true,
      real_mutation_enabled: visibilityPlan.real_mutation_enabled === true,
      list_changed_enabled: visibilityPlan.list_changed_enabled === true,
    },
    state_store_summary: {
      success: statePlan.success === true,
      current_state: statePlan.current_state,
      target_state: statePlan.target_state,
      would_change_state: statePlan.would_change_state === true,
      would_write: statePlan.write_plan?.would_write === true,
      atomic_write_required: statePlan.write_plan?.atomic_write_required === true,
      fs_write_enabled_now: statePlan.fs_write_enabled_now === true,
      execute_allowed_now: statePlan.execute_allowed_now === true,
      real_mutation_enabled: statePlan.real_mutation_enabled === true,
      proposed_store_hash: statePlan.proposed_store_hash || "",
      write_before_hash: statePlan.write_plan?.before_hash || "",
      write_after_hash: statePlan.write_plan?.after_hash || "",
    },
    tools_diff_summary: {
      change_count: toolsDiff.change_count,
      add_count: toolsDiff.add_count,
      remove_count: toolsDiff.remove_count,
      unchanged_count: toolsDiff.unchanged_count,
      current_tools_hash: toolsDiff.current_tools_hash,
      target_tools_hash: toolsDiff.target_tools_hash,
      would_change_tools_list: toolsDiff.would_change_tools_list === true,
      would_require_list_changed: toolsDiff.would_require_list_changed === true,
      real_mutation_enabled: toolsDiff.real_mutation_enabled === true,
      execute_allowed_now: toolsDiff.execute_allowed_now === true,
    },
    list_changed_summary: {
      would_notify: listChangedHarness.would_notify === true,
      ready_to_emit_now: listChangedHarness.ready_to_emit_now === true,
      notification_emitted: listChangedHarness.notification_emitted === true,
      transport_send_called: listChangedHarness.transport_send_called === true,
      transport_sent_count: listChangedHarness.transport_sent_count || 0,
      receipt_hash: listChangedReceipt.receipt_hash,
      receipt_verified: listChangedReceiptVerification.success === true,
    },
    state_receipt_summary: {
      receipt_hash: stateReceipt.receipt_hash,
      receipt_verified: stateReceiptVerification.success === true,
      transaction_applied: stateReceipt.transaction_applied === true,
      fs_write_performed: stateReceipt.fs_write_performed === true,
      list_changed_emitted: stateReceipt.list_changed_emitted === true,
      raw_record_redacted: stateReceipt.raw_record_redacted === true,
      raw_store_redacted: stateReceipt.raw_store_redacted === true,
      raw_path_redacted: stateReceipt.raw_path_redacted === true,
    },
    runtime_transport_used: false,
    runtime_tools_list_mutated: false,
    runtime_state_store_written: false,
    client_notification_emitted: false,
    raw_payloads_redacted: true,
    blockers: [
      ...(Array.isArray(visibilityPlan.blockers) ? visibilityPlan.blockers : []),
      ...(Array.isArray(statePlan.blockers) ? statePlan.blockers : []),
      ...(Array.isArray(toolsDiff.blockers) ? toolsDiff.blockers : []),
      ...(Array.isArray(listChangedHarness.blockers) ? listChangedHarness.blockers : []),
    ],
  };
}

module.exports = {
  STATE_STORE_PIPELINE_VERSION,
  runPluginVisibilityStateStorePipeline,
};
