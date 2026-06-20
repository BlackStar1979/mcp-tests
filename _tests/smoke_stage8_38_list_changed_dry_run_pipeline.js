const assert = require("node:assert/strict");
const { LIST_CHANGED_PIPELINE_VERSION, runListChangedDryRunPipeline } = require("../src/list_changed_pipeline");

(async () => {
  const enable = await runListChangedDryRunPipeline({
    currentTools: ["plugin_visibility_plan", "plugin_visibility_status"],
    toolName: "plugin_sample_echo_preview",
    targetState: "enabled",
    capabilities: { tools: { listChanged: false } },
    reason: "stage8_38",
    operator: "test",
    correlationId: "s838_enable",
  });
  assert.equal(enable.success, true);
  assert.equal(enable.pipeline_version, LIST_CHANGED_PIPELINE_VERSION);
  assert.equal(enable.allow_emit_requested, false);
  assert.equal(enable.allow_emit_effective, false);
  assert.equal(enable.diff_summary.change_count, 1);
  assert.equal(enable.diff_summary.add_count, 1);
  assert.equal(enable.diff_summary.real_mutation_enabled, false);
  assert.equal(enable.diff_summary.execute_allowed_now, false);
  assert.equal(enable.harness_summary.would_notify, true);
  assert.equal(enable.harness_summary.notification_emitted, false);
  assert.equal(enable.harness_summary.transport_send_called, false);
  assert.equal(enable.receipt_summary.verified, true);
  assert.equal(enable.client_notification_emitted, false);
  assert.equal(enable.runtime_transport_used, false);
  assert.equal(enable.runtime_tools_list_mutated, false);
  assert.equal(enable.raw_payloads_redacted, true);

  const requested = await runListChangedDryRunPipeline({
    currentTools: ["plugin_visibility_plan"],
    toolName: "plugin_sample_echo_preview",
    targetState: "enabled",
    capabilities: { tools: { listChanged: true } },
    allowEmitRequested: true,
  });
  assert.equal(requested.allow_emit_requested, true);
  assert.equal(requested.allow_emit_effective, false);
  assert.equal(requested.harness_summary.notification_emitted, false);
  assert.equal(requested.runtime_transport_used, false);

  const noop = await runListChangedDryRunPipeline({
    currentTools: ["plugin_sample_echo_preview", "plugin_visibility_plan"],
    toolName: "plugin_sample_echo_preview",
    targetState: "enabled",
    capabilities: { tools: { listChanged: true } },
  });
  assert.equal(noop.success, true);
  assert.equal(noop.diff_summary.change_count, 0);
  assert.equal(noop.harness_summary.would_notify, false);
  assert.equal(noop.receipt_summary.verified, true);

  console.log("smoke_stage8_38_list_changed_dry_run_pipeline ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
