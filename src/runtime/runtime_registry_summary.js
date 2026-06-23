"use strict";

function buildRuntimeRegistrySummary({ registryContext, label = "runtime-registry-summary" } = {}) {
  if (typeof registryContext !== "function") {
    throw new Error("buildRuntimeRegistrySummary requires registryContext function.");
  }
  const context = registryContext({ label });
  if (!context || typeof context.compactSummary !== "function") {
    throw new Error("registryContext did not return compactSummary().");
  }
  const compact = context.compactSummary();
  return Object.freeze({
    schema_version: "stage9-runtime-registry-summary-v1",
    source: "runtime_registry_context",
    label: String(label || "runtime-registry-summary"),
    registry_kind: compact.registry_kind,
    registry_version: compact.registry_version,
    tool_count: compact.tool_count,
    core_tool_count: compact.core_tool_count,
    optional_tool_count: compact.optional_tool_count,
    policy_model_ok: compact.policy_model_ok,
    policy_error_count: compact.policy_error_count,
    diff_snapshot_hash: compact.diff_snapshot_hash,
    internal_only: true,
    connector_visible_schema_changed: false,
    runtime_enforcement_changed: false,
    allow_deny_behavior_changed: false,
    registry_mutation_enabled: false,
    tools_list_mutation_enabled: false,
    list_changed_emission_enabled: false,
    state_store_write_enabled: false,
  });
}

function createRuntimeRegistrySummaryProvider({ registryContext, defaultLabel = "runtime-registry-summary" } = {}) {
  return function runtimeRegistrySummary({ label = defaultLabel } = {}) {
    return buildRuntimeRegistrySummary({ registryContext, label });
  };
}

module.exports = {
  buildRuntimeRegistrySummary,
  createRuntimeRegistrySummaryProvider,
};
