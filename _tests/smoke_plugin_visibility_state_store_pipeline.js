const assert = require("node:assert/strict");
const {
  STATE_STORE_PIPELINE_VERSION,
  runPluginVisibilityStateStorePipeline,
} = require("../src/plugin_visibility_state_store_pipeline");

const baseStore = {
  records: [
    {
      tool_name: "plugin_sample_echo_preview",
      state: "candidate",
      source: "operator-state-store",
      updated_at: "2026-05-21T00:00:00.000Z",
      updated_by: "operator",
      reason: "baseline",
    },
  ],
};

(async () => {
  const enable = await runPluginVisibilityStateStorePipeline({
    currentTools: ["plugin_visibility_plan", "plugin_visibility_status"],
    currentStore: baseStore,
    toolName: "plugin_sample_echo_preview",
    targetState: "enabled",
    operator: "operator",
    reason: "enable pipeline dry-run",
    now: "2026-05-22T08:00:00.000Z",
    stateStorePath: "private/plugin_visibility_state.json",
    capabilities: { tools: { listChanged: false } },
    correlationId: "s844_enable",
  });
  assert.equal(enable.success, true);
  assert.equal(enable.pipeline_version, STATE_STORE_PIPELINE_VERSION);
  assert.equal(enable.mode, "plugin-visibility-state-store-pipeline-dry-run");
  assert.equal(enable.allow_emit_effective, false);
  assert.equal(enable.allow_fs_write_effective, false);
  assert.equal(enable.visibility_summary.success, true);
  assert.equal(enable.state_store_summary.success, true);
  assert.equal(enable.state_store_summary.would_write, true);
  assert.equal(enable.state_store_summary.atomic_write_required, true);
  assert.equal(enable.state_store_summary.fs_write_enabled_now, false);
  assert.equal(enable.state_store_summary.real_mutation_enabled, false);
  assert.equal(enable.tools_diff_summary.change_count, 1);
  assert.equal(enable.tools_diff_summary.add_count, 1);
  assert.equal(enable.tools_diff_summary.would_require_list_changed, true);
  assert.equal(enable.list_changed_summary.would_notify, true);
  assert.equal(enable.list_changed_summary.notification_emitted, false);
  assert.equal(enable.list_changed_summary.transport_send_called, false);
  assert.equal(enable.list_changed_summary.receipt_verified, true);
  assert.equal(enable.state_receipt_summary.receipt_verified, true);
  assert.equal(enable.state_receipt_summary.transaction_applied, false);
  assert.equal(enable.state_receipt_summary.fs_write_performed, false);
  assert.equal(enable.state_receipt_summary.list_changed_emitted, false);
  assert.equal(enable.runtime_transport_used, false);
  assert.equal(enable.runtime_tools_list_mutated, false);
  assert.equal(enable.runtime_state_store_written, false);
  assert.equal(enable.client_notification_emitted, false);
  assert.equal(enable.raw_payloads_redacted, true);

  const requested = await runPluginVisibilityStateStorePipeline({
    currentTools: ["plugin_visibility_plan"],
    currentStore: baseStore,
    toolName: "plugin_sample_echo_preview",
    targetState: "enabled",
    operator: "operator",
    reason: "requested but blocked",
    now: "2026-05-22T08:10:00.000Z",
    capabilities: { tools: { listChanged: true } },
    allowEmitRequested: true,
    allowFsWriteRequested: true,
  });
  assert.equal(requested.allow_emit_requested, true);
  assert.equal(requested.allow_emit_effective, false);
  assert.equal(requested.allow_fs_write_requested, true);
  assert.equal(requested.allow_fs_write_effective, false);
  assert.equal(requested.list_changed_summary.notification_emitted, false);
  assert.equal(requested.runtime_state_store_written, false);
  assert.equal(requested.runtime_transport_used, false);

  const quarantine = await runPluginVisibilityStateStorePipeline({
    currentTools: ["plugin_visibility_plan", "plugin_visibility_status"],
    currentStore: baseStore,
    toolName: "plugin_sample_echo_preview",
    targetState: "quarantined",
    operator: "operator",
    reason: "quarantine pipeline dry-run",
    now: "2026-05-22T08:20:00.000Z",
  });
  assert.equal(quarantine.success, true);
  assert.equal(quarantine.state_receipt_summary.receipt_verified, true);
  assert.equal(quarantine.state_receipt_summary.transaction_applied, false);
  assert.equal(quarantine.runtime_state_store_written, false);

  const missingMetadata = await runPluginVisibilityStateStorePipeline({
    currentTools: ["plugin_visibility_plan"],
    currentStore: { records: [] },
    toolName: "plugin_sample_echo_preview",
    targetState: "enabled",
  });
  assert.equal(missingMetadata.success, false);
  assert.ok(missingMetadata.error.includes("updated_at is required"));
  assert.equal(missingMetadata.state_receipt_summary.receipt_verified, true);
  assert.equal(missingMetadata.runtime_state_store_written, false);
  assert.equal(missingMetadata.client_notification_emitted, false);

  console.log("smoke_plugin_visibility_state_store_pipeline ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
