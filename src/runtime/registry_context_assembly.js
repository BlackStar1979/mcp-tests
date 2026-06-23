"use strict";

const { buildRegistryPolicyReadModel, loadServerToolsSpec } = require("../registry_policy_read_model");
const { snapshotRegistryForDiff } = require("../registry_diff_dry_run");
const { createStaticToolRegistry } = require("../static_tool_registry");
const { buildCoreToolDescriptors } = require("./core_tool_descriptors");

function createRuntimeRegistryContextFactory({
  connectorShapeVersion,
  outputMode,
  maxFetchTextChars,
  optionalTools,
  rootDir,
  metadata = {},
} = {}) {
  if (!Array.isArray(optionalTools)) {
    throw new Error("createRuntimeRegistryContextFactory requires optionalTools array reference.");
  }
  const toolsSpec = loadServerToolsSpec({ rootDir });

  return function runtimeRegistryContext({ label = "runtime-current" } = {}) {
    const coreDescriptors = buildCoreToolDescriptors({
      connectorShapeVersion,
      outputMode,
      maxFetchTextChars,
    });
    const registry = createStaticToolRegistry({
      coreDescriptors,
      optionalTools,
      metadata: {
        source: "runtime_registry_context_assembly",
        ...metadata,
      },
    });
    const policyReadModel = buildRegistryPolicyReadModel({ registry, toolsSpec, rootDir });
    const registrySnapshot = registry.snapshot();
    const diffSnapshot = snapshotRegistryForDiff({ registry, label });

    return Object.freeze({
      schema_version: "stage9-runtime-registry-context-v1",
      registry,
      registry_snapshot: registrySnapshot,
      policy_read_model: policyReadModel,
      policy_snapshot: policyReadModel.snapshot({ includeEntries: false }),
      diff_snapshot: diffSnapshot,
      descriptors() {
        return registry.descriptors();
      },
      names() {
        return registry.names();
      },
      get(name) {
        return registry.get(name);
      },
      getPolicyEntry(name) {
        return policyReadModel.get(name);
      },
      compactSummary() {
        return {
          schema_version: "stage9-runtime-registry-context-summary-v1",
          registry_kind: registry.kind,
          registry_version: registry.version,
          tool_count: registrySnapshot.tool_count,
          core_tool_count: registrySnapshot.core_tool_count,
          optional_tool_count: registrySnapshot.optional_tool_count,
          policy_model_ok: policyReadModel.ok,
          policy_error_count: policyReadModel.errors.length,
          diff_snapshot_hash: diffSnapshot.entries_hash,
        };
      },
    });
  };
}

module.exports = {
  createRuntimeRegistryContextFactory,
};
