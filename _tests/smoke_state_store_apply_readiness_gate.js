const assert = require("node:assert/strict");
const { runPluginVisibilityStateStorePipeline } = require("../src/plugin_visibility_state_store_pipeline");
const {
  STATE_STORE_APPLY_GATE_VERSION,
  evaluateStateStoreApplyReadiness,
  verifyStateStoreApplyReadinessGate,
} = require("../src/plugin_visibility_state_store_apply_gate");

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
  const pipeline = await runPluginVisibilityStateStorePipeline({
    currentTools: ["plugin_visibility_plan", "plugin_visibility_status"],
    currentStore: baseStore,
    toolName: "plugin_sample_echo_preview",
    targetState: "enabled",
    operator: "operator",
    reason: "apply gate dry-run",
    now: "2026-05-22T18:00:00.000Z",
    stateStorePath: "private/plugin_visibility_state.json",
    capabilities: { tools: { listChanged: false } },
  });
  assert.equal(pipeline.success, true);

  const denied = evaluateStateStoreApplyReadiness({ pipelineResult: pipeline });
  assert.equal(denied.success, true);
  assert.equal(denied.gate_version, STATE_STORE_APPLY_GATE_VERSION);
  assert.equal(denied.mode, "plugin-visibility-state-store-apply-readiness-gate");
  assert.equal(denied.future_ready_if_apply_enabled, false);
  assert.equal(denied.apply_allowed_now, false);
  assert.equal(denied.pipeline_success, true);
  assert.equal(denied.would_write, true);
  assert.equal(denied.would_change_tools_list, true);
  assert.equal(denied.state_receipt_verified, true);
  assert.equal(denied.list_changed_receipt_verified, true);
  assert.equal(denied.raw_payloads_redacted, true);
  assert.ok(denied.missing_requirements.includes("operator_approval"));
  assert.ok(denied.missing_requirements.includes("persistence_configured"));
  assert.ok(denied.missing_requirements.includes("rollback_configured"));
  assert.ok(denied.denied_reasons.includes("readiness-only gate; apply remains disabled"));
  assert.equal(denied.runtime_state_store_written, false);
  assert.equal(denied.runtime_tools_list_mutated, false);
  assert.equal(denied.client_notification_emitted, false);
  assert.equal(verifyStateStoreApplyReadinessGate(denied).success, true);

  const futureReady = evaluateStateStoreApplyReadiness({
    pipelineResult: pipeline,
    operatorApproval: true,
    persistenceConfigured: true,
    rollbackConfigured: true,
    auditRedactionReady: true,
    connectorRefreshPlanReady: true,
    authProfileAllowed: true,
  });
  assert.equal(futureReady.future_ready_if_apply_enabled, true);
  assert.equal(futureReady.apply_allowed_now, false);
  assert.deepEqual(futureReady.missing_requirements, []);
  assert.ok(futureReady.denied_reasons.includes("readiness-only gate; apply remains disabled"));
  assert.equal(verifyStateStoreApplyReadinessGate(futureReady).success, true);

  const forced = evaluateStateStoreApplyReadiness({
    pipelineResult: pipeline,
    operatorApproval: true,
    persistenceConfigured: true,
    rollbackConfigured: true,
    auditRedactionReady: true,
    connectorRefreshPlanReady: true,
    authProfileAllowed: true,
    forceApplyRequested: true,
  });
  assert.equal(forced.force_apply_requested, true);
  assert.equal(forced.force_apply_honored, false);
  assert.equal(forced.apply_allowed_now, false);
  assert.ok(forced.denied_reasons.includes("force apply request ignored by readiness gate"));
  assert.equal(verifyStateStoreApplyReadinessGate(forced).success, true);

  const failedPipeline = await runPluginVisibilityStateStorePipeline({
    currentTools: ["plugin_visibility_plan"],
    currentStore: { records: [] },
    toolName: "plugin_sample_echo_preview",
    targetState: "enabled",
  });
  assert.equal(failedPipeline.success, false);
  const failedGate = evaluateStateStoreApplyReadiness({ pipelineResult: failedPipeline });
  assert.equal(failedGate.future_ready_if_apply_enabled, false);
  assert.ok(failedGate.missing_requirements.includes("pipeline_success"));
  assert.equal(verifyStateStoreApplyReadinessGate(failedGate).success, true);

  const tampered = { ...futureReady, apply_allowed_now: true };
  const tamperedResult = verifyStateStoreApplyReadinessGate(tampered);
  assert.equal(tamperedResult.success, false);
  assert.ok(tamperedResult.errors.includes("apply_allowed_now must remain false in readiness-only mode"));
  assert.ok(tamperedResult.errors.includes("gate_hash mismatch"));

  console.log("smoke_state_store_apply_readiness_gate ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
