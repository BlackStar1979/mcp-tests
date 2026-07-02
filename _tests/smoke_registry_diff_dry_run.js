"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { createStaticToolRegistry } = require("../src/static_tool_registry");
const {
  diffRegistrySnapshots,
  runRegistryListChangedDryRun,
  snapshotRegistryForDiff,
} = require("../src/registry_diff_dry_run");
const { loadOptionalTools } = require("../src/tool_loader");
const { buildCoreToolDescriptors } = require("../src/runtime/core_tool_descriptors");
const { loadServerProfileConfig } = require("../src/server_profile_loader");
const { createTestMcpRuntimeStatusTool } = require("../tools/authorized/test_mcp_runtime_status");
const { createObservabilityStatusTool } = require("../tools/authorized/observability_status");
const { CONNECTOR_SHAPE_VERSION, SERVER_NAME, SERVER_VERSION } = require("../src/runtime/identity");

const ROOT = path.resolve(__dirname, "..");

function runtimeStatusProvider() {
  return {
    server: { name: SERVER_NAME, version: SERVER_VERSION },
    runtime: { auth: { mode: "oauth21" }, profile: { mode: "internal" } },
  };
}

function buildAuthorizedRegistry() {
  const serverProfileConfig = loadServerProfileConfig({ profileName: "tests", authMode: "oauth21", rootDir: ROOT });
  const optionalTools = loadOptionalTools({
    profile: "internal",
    authPolicy: { mode: "oauth21", requiresAuth: true },
    serverProfileConfig,
    createRuntimeStatusTool: () => createTestMcpRuntimeStatusTool(runtimeStatusProvider),
    createObservabilityStatusTool: () => createObservabilityStatusTool({
      runtimeStatusProvider,
      auditLogPath: path.join(ROOT, "_logs", ".stage8-registry-diff-dry-run.jsonl"),
    }),
  });
  const coreDescriptors = buildCoreToolDescriptors({
    connectorShapeVersion: CONNECTOR_SHAPE_VERSION,
    outputMode: "structured",
    maxFetchTextChars: 2500,
  });
  return createStaticToolRegistry({ coreDescriptors, optionalTools, metadata: { profileName: "tests", authMode: "oauth21" } });
}

function tinyRegistry(descriptors) {
  return createStaticToolRegistry({ coreDescriptors: descriptors });
}

(() => {
  const authorized = buildAuthorizedRegistry();
  const current = snapshotRegistryForDiff({ registry: authorized, label: "authorized-current" });
  const noop = diffRegistrySnapshots({ currentSnapshot: current, targetSnapshot: current, reason: "noop" });
  assert.equal(noop.change_count, 0);
  assert.equal(noop.would_require_list_changed, false);
  assert.deepEqual(noop.add, []);
  assert.deepEqual(noop.remove, []);
  assert.deepEqual(noop.update, []);

  const base = tinyRegistry([
    { name: "alpha", description: "A", inputSchema: { type: "object" } },
    { name: "beta", description: "B", inputSchema: { type: "object" } },
  ]);
  const target = tinyRegistry([
    { name: "beta", description: "B2", inputSchema: { type: "object" } },
    { name: "gamma", description: "C", inputSchema: { type: "object" } },
  ]);
  const diff = diffRegistrySnapshots({
    currentSnapshot: snapshotRegistryForDiff({ registry: base, label: "base" }),
    targetSnapshot: snapshotRegistryForDiff({ registry: target, label: "target" }),
    reason: "add-remove-update",
    correlationId: "s8-3",
  });
  assert.equal(diff.success, true);
  assert.equal(diff.mode, "registry-diff-dry-run");
  assert.deepEqual(diff.add, ["gamma"]);
  assert.deepEqual(diff.remove, ["alpha"]);
  assert.equal(diff.update_count, 1);
  assert.deepEqual(diff.update_names, ["beta"]);
  assert.equal(diff.change_count, 3);
  assert.equal(diff.would_require_list_changed, true);
  assert.equal(diff.list_changed_enabled_now, false);
  assert.equal(diff.real_mutation_enabled, false);
  assert.ok(diff.blockers.includes("notifications/tools/list_changed emission is disabled"));

  const dryRun = runRegistryListChangedDryRun({
    currentRegistry: base,
    targetRegistry: target,
    capabilities: { tools: { listChanged: true } },
    reason: "stage8.3-registry-dry-run",
    correlationId: "s8-3-list-changed",
  });
  assert.equal(dryRun.success, true);
  assert.equal(dryRun.diff.change_count, 3);
  assert.equal(dryRun.envelope_summary.would_notify, true);
  assert.equal(dryRun.envelope_summary.notification_emitted, false);
  assert.equal(dryRun.harness_summary.notification_emitted, false);
  assert.equal(dryRun.harness_summary.transport_send_called, false);
  assert.equal(dryRun.runtime_tools_list_mutated, false);
  assert.equal(dryRun.runtime_transport_used, false);
  assert.equal(dryRun.client_notification_emitted, false);

  console.log("smoke_registry_diff_dry_run ok");
})();
