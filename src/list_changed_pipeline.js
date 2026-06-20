const { planPluginVisibility } = require("./plugin_visibility");
const { planToolsListDiffForVisibilityPlan } = require("./tools_list_diff");
const { runListChangedHarness } = require("./list_changed_harness");
const { buildListChangedAuditReceipt, verifyListChangedAuditReceipt } = require("./list_changed_audit_receipt");

const LIST_CHANGED_PIPELINE_VERSION = "test-mcp-list-changed-pipeline-v1";

async function runListChangedDryRunPipeline({
  currentTools = [],
  toolName = "",
  targetState = "enabled",
  capabilities = { tools: { listChanged: false } },
  reason = "",
  operator = "",
  correlationId = "",
  allowEmitRequested = false,
} = {}) {
  const visibilityPlan = await planPluginVisibility({
    tool_name: String(toolName || ""),
    target_state: String(targetState || ""),
  });
  const diff = planToolsListDiffForVisibilityPlan({ current: currentTools, plan: visibilityPlan });

  const allowEmitEffective = false;
  const harness = runListChangedHarness({
    diff,
    capabilities,
    allowEmit: allowEmitEffective,
    reason,
    correlationId,
  });
  const receipt = buildListChangedAuditReceipt({
    harnessResult: harness,
    stage: "8.38",
    operation: "dry_run_pipeline",
    operator,
    reason,
  });
  const receiptVerification = verifyListChangedAuditReceipt(receipt);

  return {
    success: visibilityPlan.success === true && diff.success === true && harness.success === true && receiptVerification.success === true,
    mode: "list-changed-dry-run-pipeline",
    pipeline_version: LIST_CHANGED_PIPELINE_VERSION,
    allow_emit_requested: allowEmitRequested === true,
    allow_emit_effective: allowEmitEffective,
    visibility_plan_success: visibilityPlan.success === true,
    visibility_tool_name: visibilityPlan.tool_name || String(toolName || ""),
    visibility_target_state: visibilityPlan.target_state || String(targetState || ""),
    diff_summary: {
      source: diff.source,
      change_count: diff.change_count,
      add_count: diff.add_count,
      remove_count: diff.remove_count,
      unchanged_count: diff.unchanged_count,
      current_tools_hash: diff.current_tools_hash,
      target_tools_hash: diff.target_tools_hash,
      would_change_tools_list: diff.would_change_tools_list,
      would_require_list_changed: diff.would_require_list_changed,
      real_mutation_enabled: diff.real_mutation_enabled,
      execute_allowed_now: diff.execute_allowed_now,
    },
    harness_summary: {
      would_notify: harness.would_notify,
      ready_to_emit_now: harness.ready_to_emit_now,
      notification_emitted: harness.notification_emitted,
      transport_send_called: harness.transport_send_called,
      transport_sent_count: harness.transport_sent_count,
      blocker_count: Array.isArray(harness.blockers) ? harness.blockers.length : 0,
    },
    receipt_summary: {
      receipt_hash: receipt.receipt_hash,
      diff_hash: receipt.diff_hash,
      envelope_hash: receipt.envelope_hash,
      readiness_hash: receipt.readiness_hash,
      blocker_count: receipt.blocker_count,
      raw_messages_redacted: receipt.raw_messages_redacted,
      raw_tool_lists_redacted: receipt.raw_tool_lists_redacted,
      verified: receiptVerification.success,
    },
    client_notification_emitted: false,
    runtime_transport_used: false,
    runtime_tools_list_mutated: false,
    raw_payloads_redacted: true,
    blockers: harness.blockers || [],
  };
}

module.exports = {
  LIST_CHANGED_PIPELINE_VERSION,
  runListChangedDryRunPipeline,
};
