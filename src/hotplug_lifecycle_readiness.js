"use strict";

const { createStaticToolRegistry } = require("./static_tool_registry");
const { runRegistryListChangedDryRun } = require("./registry_diff_dry_run");
const { LIST_CHANGED_METHOD } = require("./list_changed_notification_bus");
const { runListChangedHarness } = require("./list_changed_harness");
const { runPluginVisibilityStateStorePipeline } = require("./plugin_visibility_state_store_pipeline");
const { evaluateStateStoreApplyReadiness } = require("./plugin_visibility_state_store_apply_gate");
const { buildSecurityFirstPreflight, verifySecurityFirstPreflight } = require("./security_first_preflight");

const HOTPLUG_LIFECYCLE_READINESS_VERSION = "test-mcp-hotplug-lifecycle-readiness-v1";

function tinyRegistry(descriptors) {
  return createStaticToolRegistry({ coreDescriptors: descriptors });
}

function baseStore() {
  return {
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
}

function buildRegistryDryRun() {
  const current = tinyRegistry([
    { name: "alpha", description: "A", inputSchema: { type: "object" } },
    { name: "beta", description: "B", inputSchema: { type: "object" } },
  ]);
  const target = tinyRegistry([
    { name: "beta", description: "B2", inputSchema: { type: "object" } },
    { name: "gamma", description: "C", inputSchema: { type: "object" } },
  ]);
  return runRegistryListChangedDryRun({
    currentRegistry: current,
    targetRegistry: target,
    capabilities: { tools: { listChanged: true } },
    reason: "event-driven-hotplug-lifecycle-readiness",
    correlationId: "hotplug-lifecycle-readiness",
  });
}

async function buildStateStorePipeline() {
  return runPluginVisibilityStateStorePipeline({
    currentTools: ["plugin_visibility_plan", "plugin_visibility_status"],
    currentStore: baseStore(),
    toolName: "plugin_sample_echo_preview",
    targetState: "enabled",
    operator: "operator",
    reason: "event-driven hotplug lifecycle readiness",
    now: "2026-06-28T21:20:00.000Z",
    stateStorePath: "state-store-preview.json",
    capabilities: { tools: { listChanged: false } },
    allowEmitRequested: true,
    allowFsWriteRequested: true,
  });
}

async function buildHotplugLifecycleReadiness() {
  const registryDryRun = buildRegistryDryRun();
  const mockHarness = runListChangedHarness({
    diff: registryDryRun.diff,
    capabilities: { tools: { listChanged: true } },
    allowEmit: true,
    reason: "mock-harness-only",
    correlationId: "hotplug-hpl4",
  });
  const pipeline = await buildStateStorePipeline();
  const applyGate = evaluateStateStoreApplyReadiness({
    pipelineResult: pipeline,
    operatorApproval: true,
    persistenceConfigured: true,
    rollbackConfigured: true,
    auditRedactionReady: true,
    connectorRefreshPlanReady: true,
    authProfileAllowed: true,
    forceApplyRequested: true,
  });

  const preflight = await buildSecurityFirstPreflight({
    pipelineResult: pipeline,
    applyGateResult: applyGate,
    auditLikePayload: { sample: "bounded hotplug lifecycle readiness fixture" },
    authPosture: {
      mode: "oauth21",
      operator_decision_required: true,
      operator_decision_ready: true,
      real_auth_cutover_requested: false,
    },
    connectorRefreshPlanReady: true,
    request: {
      apply: true,
      realMutation: true,
      listChangedEmit: true,
      dynamicImport: true,
    },
  });
  const preflightVerification = verifySecurityFirstPreflight(preflight);

  const hpl = {
    hpl1_registry_abstraction: { status: "done", evidence: "static registry renders current tool descriptors without visible behavior change" },
    hpl2_diff_model: { status: "done", evidence: "registry diff dry-run detects add/remove/update and requires list_changed without mutation" },
    hpl3_state_store_apply_gate: { status: "done", evidence: "state-store pipeline and apply-readiness gate verify receipts but keep apply disabled" },
    hpl4_local_harness_emission: { status: "done_mock_only", evidence: "local harness can send mock list_changed envelope while live runtime remains disabled" },
    hpl5_runtime_apply_prototype: { status: "gated_pending_explicit_operator_runtime_action", evidence: "security-first preflight denies apply, mutation, dynamic import, and live list_changed emission" },
  };

  return {
    success: registryDryRun.success === true && pipeline.success === true && preflightVerification.success === true,
    mode: "event-driven-hotplug-lifecycle-readiness",
    readiness_version: HOTPLUG_LIFECYCLE_READINESS_VERSION,
    list_changed_method: LIST_CHANGED_METHOD,
    hpl,
    current_behavior: {
      registry_diff_available: registryDryRun.diff?.change_count > 0,
      state_store_pipeline_available: pipeline.success === true,
      local_mock_emission_available: mockHarness.notification_emitted === true,
      runtime_apply_allowed_now: false,
      runtime_tools_list_mutated: false,
      runtime_state_store_written: false,
      runtime_transport_send_allowed_now: false,
      client_notification_emitted_live: false,
      connector_refresh_required_now: false,
      runtime_restart_required_now: false,
    },
      
    summaries: {
      registry_diff: {
        change_count: registryDryRun.diff?.change_count || 0,
        would_require_list_changed: registryDryRun.diff?.would_require_list_changed === true,
        runtime_tools_list_mutated: registryDryRun.runtime_tools_list_mutated === true,
        client_notification_emitted: registryDryRun.client_notification_emitted === true,
      },
      mock_harness: {
        notification_emitted: mockHarness.notification_emitted === true,
        transport_send_called: mockHarness.transport_send_called === true,
        transport_sent_count: mockHarness.transport_sent_count || 0,
      },
      state_store_pipeline: {
        success: pipeline.success === true,
        allow_emit_effective: pipeline.allow_emit_effective === true,
        allow_fs_write_effective: pipeline.allow_fs_write_effective === true,
        runtime_state_store_written: pipeline.runtime_state_store_written === true,
        runtime_tools_list_mutated: pipeline.runtime_tools_list_mutated === true,
        client_notification_emitted: pipeline.client_notification_emitted === true,
      },
      apply_gate: {
        future_ready_if_apply_enabled: applyGate.future_ready_if_apply_enabled === true,
        apply_allowed_now: applyGate.apply_allowed_now === true,
        force_apply_honored: applyGate.force_apply_honored === true,
      },
      security_first_preflight: {
        verified: preflightVerification.success === true,
        apply_allowed_now: preflight.apply_allowed_now === true,
        real_mutation_allowed_now: preflight.real_mutation_allowed_now === true,
        list_changed_emit_allowed_now: preflight.list_changed_emit_allowed_now === true,
        dynamic_import_allowed_now: preflight.dynamic_import_allowed_now === true,
      },
    },
    blocker_reassessment: {
      stale_blockers_removed: [
        "HPL1 registry abstraction not started",
        "HPL2 diff model not integrated",
        "HPL3 apply gate not available",
        "HPL4 local harness not available",
      ],
      valid_blockers_remaining: [
        "HPL5 runtime apply prototype requires explicit operator runtime action",
        "live list_changed emission remains disabled",
        "real tools/list mutation remains disabled",
        "state-store writes remain disabled",
        "dynamic import remains disabled",
      ],
    },
  };
}

module.exports = {
  HOTPLUG_LIFECYCLE_READINESS_VERSION,
  buildHotplugLifecycleReadiness,
};
