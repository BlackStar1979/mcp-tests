const assert = require("node:assert/strict");
const {
  SECURITY_FIRST_PREFLIGHT_VERSION,
  buildSecurityFirstPreflight,
  verifySecurityFirstPreflight,
} = require("../src/security_first_preflight");

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

const pipelineInput = {
  currentTools: ["plugin_visibility_plan", "plugin_visibility_status"],
  currentStore: baseStore,
  toolName: "plugin_sample_echo_preview",
  targetState: "enabled",
  operator: "operator",
  reason: "security-first preflight dry-run",
  now: "2026-05-22T19:20:00.000Z",
  stateStorePath: "state-store-preview.json",
  capabilities: { tools: { listChanged: false } },
};

const fullApplyGateInput = {
  operatorApproval: true,
  persistenceConfigured: true,
  rollbackConfigured: true,
  auditRedactionReady: true,
  connectorRefreshPlanReady: true,
  authProfileAllowed: true,
};

const readyAuthPosture = {
  mode: "none",
  operator_decision_required: true,
  operator_decision_ready: true,
  real_auth_cutover_requested: false,
};

const safeAuditLikePayload = {
  audit_export_safety: {
    export_safe: false,
    raw_path_like_value_count: 1,
    sensitive_path_hint_count: 0,
  },
  sample: "bounded redaction summary fixture",
};

function assertStage847DenyInvariants(preflight) {
  assert.equal(preflight.preflight_version, SECURITY_FIRST_PREFLIGHT_VERSION);
  assert.equal(preflight.apply_allowed_now, false);
  assert.equal(preflight.real_mutation_allowed_now, false);
  assert.equal(preflight.list_changed_emit_allowed_now, false);
  assert.equal(preflight.dynamic_import_allowed_now, false);
  assert.equal(preflight.raw_audit_export_allowed, false);
  assert.equal(preflight.production_porting_allowed_now, false);
  assert.equal(preflight.auth_cutover_allowed_now, false);
  assert.equal(preflight.fs_write_allowed_now, false);
  assert.equal(preflight.runtime_transport_send_allowed_now, false);
  assert.equal(preflight.raw_payloads_included, false);
  assert.ok(preflight.denied_reasons.includes("Stage 8 / Step 47 is preflight-only; applied behavior remains disabled"));
  assert.equal(verifySecurityFirstPreflight(preflight).success, true);
}

(async () => {
  const futureReady = await buildSecurityFirstPreflight({
    pipelineInput,
    applyGateInput: fullApplyGateInput,
    auditLikePayload: safeAuditLikePayload,
    authPosture: readyAuthPosture,
    connectorRefreshPlanReady: true,
  });
  assert.equal(futureReady.success, true);
  assert.equal(futureReady.mode, "security-first-preflight-consolidation");
  assert.equal(futureReady.future_ready_if_enabled, true);
  assert.deepEqual(futureReady.missing_requirements, []);
  assertStage847DenyInvariants(futureReady);
  assert.equal(futureReady.component_summaries.state_store_pipeline.success, true);
  assert.equal(futureReady.component_summaries.apply_gate.future_ready_if_apply_enabled, true);
  assert.equal(futureReady.component_summaries.observability_redaction_summary.raw_export_allowed, false);
  assert.equal(futureReady.component_summaries.plugin_execution_governance.dynamic_import_enabled, false);

  const missingOperator = await buildSecurityFirstPreflight({
    pipelineInput,
    applyGateInput: { ...fullApplyGateInput, operatorApproval: false },
    auditLikePayload: safeAuditLikePayload,
    authPosture: readyAuthPosture,
    connectorRefreshPlanReady: true,
  });
  assert.equal(missingOperator.future_ready_if_enabled, false);
  assert.ok(missingOperator.missing_requirements.includes("operator_approval"));
  assertStage847DenyInvariants(missingOperator);

  const unsafeRedaction = await buildSecurityFirstPreflight({
    pipelineInput,
    applyGateInput: fullApplyGateInput,
    observabilityRedactionSummary: {
      success: false,
      mode: "observability-redaction-summary-prototype",
      summary_version: "test-mcp-observability-redaction-summary-v1",
      raw_export_allowed: false,
      raw_payload_included: false,
      redacted_payload_included: false,
      after_export_safe: false,
      observability_status_schema_changed: false,
      connector_visible_change: false,
      connector_refresh_required_now: false,
      raw_audit_log_mutated: false,
      public_export_tool_added: false,
      summary_hash: "tampered",
    },
    auditLikePayload: safeAuditLikePayload,
    authPosture: readyAuthPosture,
    connectorRefreshPlanReady: true,
  });
  assert.equal(unsafeRedaction.future_ready_if_enabled, false);
  assert.ok(unsafeRedaction.missing_requirements.includes("audit_redaction_summary_safe"));
  assertStage847DenyInvariants(unsafeRedaction);

  const requestedDenied = await buildSecurityFirstPreflight({
    pipelineInput,
    applyGateInput: fullApplyGateInput,
    auditLikePayload: safeAuditLikePayload,
    authPosture: readyAuthPosture,
    connectorRefreshPlanReady: true,
    request: {
      apply: true,
      realMutation: true,
      listChangedEmit: true,
      dynamicImport: true,
      rawAuditExport: true,
      productionPorting: true,
      authCutover: true,
    },
  });
  assert.equal(requestedDenied.future_ready_if_enabled, false);
  assert.equal(requestedDenied.request_summary.dynamic_import_requested, true);
  assert.equal(requestedDenied.request_summary.list_changed_emit_requested, true);
  assert.ok(requestedDenied.denied_reasons.includes("dynamic import request denied by Stage 8 / Step 47 preflight"));
  assert.ok(requestedDenied.denied_reasons.includes("list_changed emission request denied by Stage 8 / Step 47 preflight"));
  assert.ok(requestedDenied.denied_reasons.includes("production porting request denied by Stage 8 / Step 47 preflight"));
  assert.ok(requestedDenied.denied_reasons.includes("raw audit export request denied by Stage 8 / Step 47 preflight"));
  assert.ok(requestedDenied.denied_reasons.includes("auth cutover request denied by Stage 8 / Step 47 preflight"));
  assert.ok(requestedDenied.missing_requirements.includes("raw_audit_export_prohibited"));
  assert.ok(requestedDenied.missing_requirements.includes("production_porting_not_requested"));
  assert.ok(requestedDenied.missing_requirements.includes("real_auth_cutover_not_requested"));
  assertStage847DenyInvariants(requestedDenied);

  const tampered = { ...futureReady, dynamic_import_allowed_now: true };
  const tamperedResult = verifySecurityFirstPreflight(tampered);
  assert.equal(tamperedResult.success, false);
  assert.ok(tamperedResult.errors.includes("dynamic_import_allowed_now must be false"));
  assert.ok(tamperedResult.errors.includes("preflight_hash mismatch"));

  console.log("smoke_stage8_47_security_first_preflight ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
