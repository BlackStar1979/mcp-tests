const crypto = require("node:crypto");
const { runPluginVisibilityStateStorePipeline } = require("./plugin_visibility_state_store_pipeline");
const {
  evaluateStateStoreApplyReadiness,
  verifyStateStoreApplyReadinessGate,
} = require("./plugin_visibility_state_store_apply_gate");
const {
  buildObservabilityRedactionSummary,
  verifyObservabilityRedactionSummary,
} = require("./observability_redaction_summary");
const {
  buildAuditRedactionIntegrationPlan,
  verifyAuditRedactionIntegrationPlan,
} = require("./audit_redaction_integration_plan");
const { getPluginExecutionGovernance } = require("./plugin_execution");

const SECURITY_FIRST_PREFLIGHT_VERSION = "test-mcp-security-first-preflight-v1";

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function bool(value) {
  return value === true;
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function compactPipelineSummary(pipeline = {}) {
  return {
    success: bool(pipeline.success),
    mode: pipeline.mode || "",
    pipeline_version: pipeline.pipeline_version || "",
    state_store_dry_run: bool(pipeline.state_store_summary?.success),
    apply_write_requested: bool(pipeline.allow_fs_write_requested),
    fs_write_effective: bool(pipeline.allow_fs_write_effective),
    would_write: bool(pipeline.state_store_summary?.would_write),
    runtime_state_store_written: bool(pipeline.runtime_state_store_written),
    tools_list_dry_run: bool(pipeline.tools_diff_summary),
    would_change_tools_list: bool(pipeline.tools_diff_summary?.would_change_tools_list),
    runtime_tools_list_mutated: bool(pipeline.runtime_tools_list_mutated),
    list_changed_receipt_verified: bool(pipeline.list_changed_summary?.receipt_verified),
    list_changed_ready_to_emit_now: bool(pipeline.list_changed_summary?.ready_to_emit_now),
    list_changed_notification_emitted: bool(pipeline.list_changed_summary?.notification_emitted),
    list_changed_transport_send_called: bool(pipeline.list_changed_summary?.transport_send_called),
    state_receipt_verified: bool(pipeline.state_receipt_summary?.receipt_verified),
    raw_payloads_redacted: bool(pipeline.raw_payloads_redacted),
  };
}

function compactApplyGateSummary(gate = {}, verification = {}) {
  return {
    success: bool(gate.success),
    verified: bool(verification.success),
    mode: gate.mode || "",
    gate_version: gate.gate_version || "",
    future_ready_if_apply_enabled: bool(gate.future_ready_if_apply_enabled),
    apply_allowed_now: bool(gate.apply_allowed_now),
    force_apply_honored: bool(gate.force_apply_honored),
    runtime_state_store_written: bool(gate.runtime_state_store_written),
    runtime_tools_list_mutated: bool(gate.runtime_tools_list_mutated),
    client_notification_emitted: bool(gate.client_notification_emitted),
    missing_requirements: Array.isArray(gate.missing_requirements) ? gate.missing_requirements : [],
  };
}

function compactRedactionSummary(summary = {}, verification = {}) {
  return {
    success: bool(summary.success),
    verified: bool(verification.success),
    mode: summary.mode || "",
    summary_version: summary.summary_version || "",
    export_mode: summary.export_mode || "",
    raw_export_allowed: bool(summary.raw_export_allowed),
    raw_payload_included: bool(summary.raw_payload_included),
    redacted_payload_included: bool(summary.redacted_payload_included),
    after_export_safe: bool(summary.after_export_safe),
    connector_visible_change: bool(summary.connector_visible_change),
    connector_refresh_required_now: bool(summary.connector_refresh_required_now),
    public_export_tool_added: bool(summary.public_export_tool_added),
  };
}

function compactAuditIntegrationPlan(plan = {}, verification = {}) {
  return {
    success: bool(plan.success),
    verified: bool(verification.success),
    mode: plan.mode || "",
    integration_plan_version: plan.integration_plan_version || "",
    raw_export_allowed: bool(plan.raw_export_allowed),
    raw_payload_redacted: bool(plan.raw_payload_redacted),
    new_public_tool_allowed_now: bool(plan.new_public_tool_allowed_now),
    connector_refresh_required_now: bool(plan.connector_refresh_required_now),
    descriptor_change_allowed_now: bool(plan.descriptor_change_allowed_now),
    schema_change_allowed_now: bool(plan.schema_change_allowed_now),
    tool_surface_change_allowed_now: bool(plan.tool_surface_change_allowed_now),
    recommended_export_mode: plan.recommended_export_mode || "",
  };
}

function compactGovernanceSummary(governance = {}) {
  return {
    success: bool(governance.success),
    mode: governance.mode || "",
    governance_version: governance.governance_version || "",
    general_plugin_execution_allowed: bool(governance.general_plugin_execution_allowed),
    readonly_plugin_execution_wrapper_allowed: bool(governance.readonly_plugin_execution_wrapper_allowed),
    dynamic_import_enabled: bool(governance.dynamic_import_enabled),
    arbitrary_plugin_file_execution_enabled: bool(governance.arbitrary_plugin_file_execution_enabled),
    real_tools_list_mutation_enabled: bool(governance.real_tools_list_mutation_enabled),
    list_changed_enabled: bool(governance.list_changed_enabled),
  };
}

function buildMissingRequirements({
  pipelineSummary,
  applyGateSummary,
  redactionSummary,
  auditPlanSummary,
  governanceSummary,
  authPosture,
  connectorRefreshPlanReady,
  rawAuditExportRequested,
  productionPortingRequested,
} = {}) {
  const missing = [];
  if (!pipelineSummary.success) missing.push("state_store_pipeline_dry_run_success");
  if (!pipelineSummary.state_receipt_verified) missing.push("state_store_receipt_verified");
  if (!pipelineSummary.list_changed_receipt_verified) missing.push("list_changed_receipt_verified");
  if (!pipelineSummary.raw_payloads_redacted) missing.push("pipeline_raw_payloads_redacted");
  if (pipelineSummary.runtime_state_store_written) missing.push("runtime_state_store_not_written");
  if (pipelineSummary.runtime_tools_list_mutated) missing.push("runtime_tools_list_not_mutated");
  if (pipelineSummary.list_changed_notification_emitted) missing.push("list_changed_not_emitted");
  if (pipelineSummary.list_changed_transport_send_called) missing.push("transport_send_not_called");

  if (!applyGateSummary.verified) missing.push("apply_gate_verified");
  for (const item of applyGateSummary.missing_requirements || []) missing.push(item);

  if (!redactionSummary.success || !redactionSummary.verified || !redactionSummary.after_export_safe) {
    missing.push("audit_redaction_summary_safe");
  }
  if (!auditPlanSummary.success || !auditPlanSummary.verified) missing.push("audit_redaction_integration_plan_verified");
  if (redactionSummary.raw_export_allowed || auditPlanSummary.raw_export_allowed || rawAuditExportRequested) {
    missing.push("raw_audit_export_prohibited");
  }
  if (redactionSummary.raw_payload_included || redactionSummary.redacted_payload_included) {
    missing.push("no_audit_payload_bodies_in_preflight");
  }

  if (!governanceSummary.success) missing.push("plugin_execution_governance_success");
  if (governanceSummary.dynamic_import_enabled) missing.push("dynamic_import_disabled");
  if (governanceSummary.general_plugin_execution_allowed) missing.push("general_plugin_execution_disabled");
  if (governanceSummary.real_tools_list_mutation_enabled) missing.push("plugin_tools_list_mutation_disabled");
  if (governanceSummary.list_changed_enabled) missing.push("plugin_list_changed_disabled");

  if (authPosture.operator_decision_ready !== true) missing.push("auth_operator_decision_ready");
  if (authPosture.real_auth_cutover_requested === true) missing.push("real_auth_cutover_not_requested");
  if (connectorRefreshPlanReady !== true) missing.push("connector_refresh_plan_ready");
  if (productionPortingRequested === true) missing.push("production_porting_not_requested");

  return unique(missing);
}

async function buildSecurityFirstPreflight({
  pipelineInput = {},
  pipelineResult,
  applyGateInput = {},
  applyGateResult,
  auditLikePayload = {},
  observabilityRedactionSummary,
  auditRedactionIntegrationPlan,
  pluginExecutionGovernance,
  authPosture = {},
  connectorRefreshPlanReady = false,
  request = {},
} = {}) {
  const pipeline = pipelineResult || await runPluginVisibilityStateStorePipeline(pipelineInput);
  const redaction = observabilityRedactionSummary || buildObservabilityRedactionSummary({ auditLikePayload });
  const auditPlan = auditRedactionIntegrationPlan || buildAuditRedactionIntegrationPlan({ samplePayload: auditLikePayload });
  const governance = pluginExecutionGovernance || getPluginExecutionGovernance();
  const gate = applyGateResult || evaluateStateStoreApplyReadiness({
    pipelineResult: pipeline,
    operatorApproval: applyGateInput.operatorApproval === true,
    persistenceConfigured: applyGateInput.persistenceConfigured === true,
    rollbackConfigured: applyGateInput.rollbackConfigured === true,
    auditRedactionReady: applyGateInput.auditRedactionReady === true,
    connectorRefreshPlanReady: applyGateInput.connectorRefreshPlanReady === true,
    authProfileAllowed: applyGateInput.authProfileAllowed === true,
    forceApplyRequested: request.apply === true || applyGateInput.forceApplyRequested === true,
  });

  const gateVerification = verifyStateStoreApplyReadinessGate(gate);
  const redactionVerification = verifyObservabilityRedactionSummary(redaction);
  const auditPlanVerification = verifyAuditRedactionIntegrationPlan(auditPlan);

  const normalizedAuthPosture = {
    mode: String(authPosture.mode || "none"),
    operator_decision_required: authPosture.operator_decision_required !== false,
    operator_decision_ready: authPosture.operator_decision_ready === true,
    real_auth_cutover_requested: authPosture.real_auth_cutover_requested === true || request.authCutover === true,
  };

  const pipelineSummary = compactPipelineSummary(pipeline);
  const applyGateSummary = compactApplyGateSummary(gate, gateVerification);
  const redactionSummary = compactRedactionSummary(redaction, redactionVerification);
  const auditPlanSummary = compactAuditIntegrationPlan(auditPlan, auditPlanVerification);
  const governanceSummary = compactGovernanceSummary(governance);

  const requestSummary = {
    apply_requested: request.apply === true,
    real_mutation_requested: request.realMutation === true,
    list_changed_emit_requested: request.listChangedEmit === true,
    dynamic_import_requested: request.dynamicImport === true,
    raw_audit_export_requested: request.rawAuditExport === true,
    production_porting_requested: request.productionPorting === true,
    auth_cutover_requested: request.authCutover === true,
  };

  const missingRequirements = buildMissingRequirements({
    pipelineSummary,
    applyGateSummary,
    redactionSummary,
    auditPlanSummary,
    governanceSummary,
    authPosture: normalizedAuthPosture,
    connectorRefreshPlanReady,
    rawAuditExportRequested: requestSummary.raw_audit_export_requested,
    productionPortingRequested: requestSummary.production_porting_requested,
  });

  const requestDenials = [
    requestSummary.apply_requested ? "apply request denied by Stage 8 / Step 47 preflight" : "",
    requestSummary.real_mutation_requested ? "real mutation request denied by Stage 8 / Step 47 preflight" : "",
    requestSummary.list_changed_emit_requested ? "list_changed emission request denied by Stage 8 / Step 47 preflight" : "",
    requestSummary.dynamic_import_requested ? "dynamic import request denied by Stage 8 / Step 47 preflight" : "",
    requestSummary.raw_audit_export_requested ? "raw audit export request denied by Stage 8 / Step 47 preflight" : "",
    requestSummary.production_porting_requested ? "production porting request denied by Stage 8 / Step 47 preflight" : "",
    requestSummary.auth_cutover_requested ? "auth cutover request denied by Stage 8 / Step 47 preflight" : "",
  ].filter(Boolean);

  const basis = {
    success: true,
    error: "",
    mode: "security-first-preflight-consolidation",
    preflight_version: SECURITY_FIRST_PREFLIGHT_VERSION,
    future_ready_if_enabled: missingRequirements.length === 0,
    apply_allowed_now: false,
    real_mutation_allowed_now: false,
    list_changed_emit_allowed_now: false,
    dynamic_import_allowed_now: false,
    raw_audit_export_allowed: false,
    production_porting_allowed_now: false,
    auth_cutover_allowed_now: false,
    connector_refresh_required_now: false,
    runtime_restart_required_now: false,
    descriptor_change_allowed_now: false,
    schema_change_allowed_now: false,
    tool_surface_change_allowed_now: false,
    fs_write_allowed_now: false,
    runtime_transport_send_allowed_now: false,
    raw_payloads_included: false,
    request_summary: requestSummary,
    auth_posture: normalizedAuthPosture,
    missing_requirements: missingRequirements,
    denied_reasons: unique([
      "Stage 8 / Step 47 is preflight-only; applied behavior remains disabled",
      ...requestDenials,
      ...missingRequirements.map((name) => `missing requirement: ${name}`),
    ]),
    component_summaries: {
      state_store_pipeline: pipelineSummary,
      apply_gate: applyGateSummary,
      observability_redaction_summary: redactionSummary,
      audit_redaction_integration_plan: auditPlanSummary,
      plugin_execution_governance: governanceSummary,
    },
    blockers: unique([
      ...missingRequirements,
      ...requestDenials,
    ]),
    required_future_approvals: [
      "Stage 8 / Step 48 operator decision packet before any controlled persistence experiment",
      "explicit durable persistence configuration before any state-store write",
      "explicit rollback/quarantine recovery validation before apply",
      "manual connector refresh plan before any schema, descriptor, or tool-surface change",
      "explicit auth/profile boundary decision before auth cutover",
      "explicit production-porting approval before changes outside TEST MCP workbench",
    ],
  };

  return {
    ...basis,
    preflight_hash: hashJson(basis),
  };
}

function verifySecurityFirstPreflight(preflight = {}) {
  const errors = [];
  if (preflight.preflight_version !== SECURITY_FIRST_PREFLIGHT_VERSION) errors.push("unsupported preflight version");
  if (preflight.apply_allowed_now !== false) errors.push("apply_allowed_now must be false in Stage 8 / Step 47");
  if (preflight.real_mutation_allowed_now !== false) errors.push("real_mutation_allowed_now must be false");
  if (preflight.list_changed_emit_allowed_now !== false) errors.push("list_changed_emit_allowed_now must be false");
  if (preflight.dynamic_import_allowed_now !== false) errors.push("dynamic_import_allowed_now must be false");
  if (preflight.raw_audit_export_allowed !== false) errors.push("raw_audit_export_allowed must be false");
  if (preflight.production_porting_allowed_now !== false) errors.push("production_porting_allowed_now must be false");
  if (preflight.auth_cutover_allowed_now !== false) errors.push("auth_cutover_allowed_now must be false");
  if (preflight.connector_refresh_required_now !== false) errors.push("connector refresh must not be required now");
  if (preflight.runtime_restart_required_now !== false) errors.push("runtime restart must not be required now");
  if (preflight.descriptor_change_allowed_now !== false) errors.push("descriptor change must not be allowed now");
  if (preflight.schema_change_allowed_now !== false) errors.push("schema change must not be allowed now");
  if (preflight.tool_surface_change_allowed_now !== false) errors.push("tool surface change must not be allowed now");
  if (preflight.fs_write_allowed_now !== false) errors.push("fs_write_allowed_now must be false");
  if (preflight.runtime_transport_send_allowed_now !== false) errors.push("runtime_transport_send_allowed_now must be false");
  if (preflight.raw_payloads_included !== false) errors.push("raw_payloads_included must be false");
  if (!Array.isArray(preflight.missing_requirements)) errors.push("missing_requirements must be an array");
  if (!Array.isArray(preflight.denied_reasons)) errors.push("denied_reasons must be an array");
  if (!Array.isArray(preflight.blockers)) errors.push("blockers must be an array");
  if (!Array.isArray(preflight.required_future_approvals)) errors.push("required_future_approvals must be an array");
  if (!preflight.denied_reasons?.includes("Stage 8 / Step 47 is preflight-only; applied behavior remains disabled")) {
    errors.push("preflight-only denial is required");
  }
  if (!preflight.component_summaries || typeof preflight.component_summaries !== "object") {
    errors.push("component_summaries is required");
  }
  if (!preflight.preflight_hash || typeof preflight.preflight_hash !== "string") errors.push("preflight_hash is required");

  const copy = { ...preflight };
  delete copy.preflight_hash;
  if (preflight.preflight_hash && preflight.preflight_hash !== hashJson(copy)) errors.push("preflight_hash mismatch");

  return {
    success: errors.length === 0,
    error: errors.join("; "),
    version: SECURITY_FIRST_PREFLIGHT_VERSION,
    errors,
  };
}

module.exports = {
  SECURITY_FIRST_PREFLIGHT_VERSION,
  buildSecurityFirstPreflight,
  verifySecurityFirstPreflight,
};
