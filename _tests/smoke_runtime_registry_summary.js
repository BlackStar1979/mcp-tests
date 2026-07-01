"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { createRuntimeSupportAssembly } = require("../src/runtime/runtime_support_assembly");
const { configureOptionalToolsAssembly } = require("../src/runtime/optional_tools_assembly");
const { buildRuntimeRegistrySummary, createRuntimeRegistrySummaryProvider } = require("../src/runtime/runtime_registry_summary");
const { loadServerProfileConfig } = require("../src/server_profile_loader");
const { createTestMcpRuntimeStatusTool } = require("../tools/authorized/test_mcp_runtime_status");
const { CONNECTOR_SHAPE_VERSION, SERVER_NAME, SERVER_VERSION, AUDIT_VERSION } = require("../src/runtime/identity");

const ROOT = path.resolve(__dirname, "..");

function makeRuntimeStatusProvider({ authMode, profile }) {
  return () => ({
    server: { name: SERVER_NAME, version: SERVER_VERSION },
    runtime: { auth: { mode: authMode }, profile: { mode: profile } },
  });
}

function buildSupport({ authMode, runtimeProfile }) {
  const optionalTools = [];
  const support = createRuntimeSupportAssembly({
    auditLogPath: path.join(ROOT, "_logs", `.stage9-runtime-registry-summary-${authMode}.jsonl`),
    auditVersion: AUDIT_VERSION,
    serverName: SERVER_NAME,
    serverVersion: SERVER_VERSION,
    connectorShapeVersion: CONNECTOR_SHAPE_VERSION,
    docs: [],
    publicBaseUrl: authMode === "none" ? "http://127.0.0.1:3009" : "http://127.0.0.1:3008",
    maxFetchTextChars: 2500,
    outputMode: "structured",
    optionalTools,
    rootDir: ROOT,
  });
  const serverProfileConfig = loadServerProfileConfig({ profileName: "tests", authMode, rootDir: ROOT });
  configureOptionalToolsAssembly({
    optionalTools,
    profile: runtimeProfile,
    authPolicy: { mode: authMode, requiresAuth: authMode !== "none" },
    serverProfileConfig,
    runtimeStatusProvider: makeRuntimeStatusProvider({ authMode, profile: runtimeProfile }),
    auditLogPath: path.join(ROOT, "_logs", `.stage9-runtime-registry-summary-${authMode}-optional.jsonl`),
  });
  return support;
}

function assertSummary(label, summary, expected) {
  assert.equal(summary.schema_version, "stage9-runtime-registry-summary-v1", `${label} schema`);
  assert.equal(summary.internal_only, true, `${label} internal only`);
  assert.equal(summary.connector_visible_schema_changed, false, `${label} connector schema unchanged`);
  assert.equal(summary.runtime_enforcement_changed, false, `${label} enforcement unchanged`);
  assert.equal(summary.allow_deny_behavior_changed, false, `${label} behavior unchanged`);
  assert.equal(summary.registry_mutation_enabled, false, `${label} registry mutation disabled`);
  assert.equal(summary.tools_list_mutation_enabled, false, `${label} tools/list mutation disabled`);
  assert.equal(summary.list_changed_emission_enabled, false, `${label} list_changed disabled`);
  assert.equal(summary.state_store_write_enabled, false, `${label} state-store disabled`);
  assert.equal(summary.tool_count, expected.total, `${label} total count`);
  assert.equal(summary.core_tool_count, 2, `${label} core count`);
  assert.equal(summary.optional_tool_count, expected.optional, `${label} optional count`);
  assert.equal(summary.policy_model_ok, true, `${label} policy ok`);
  assert.equal(summary.policy_error_count, 0, `${label} policy error count`);
  assert.ok(typeof summary.diff_snapshot_hash === "string" && summary.diff_snapshot_hash.length >= 12, `${label} diff hash`);
}

(async () => {
  const publicSupport = buildSupport({ authMode: "none", runtimeProfile: "public" });
  const publicSummary = buildRuntimeRegistrySummary({ registryContext: publicSupport.registryContext, label: "public-summary" });
  assertSummary("public", publicSummary, { total: 13, optional: 11 });

  const authorizedSupport = buildSupport({ authMode: "oauth21", runtimeProfile: "internal" });
  const provider = createRuntimeRegistrySummaryProvider({ registryContext: authorizedSupport.registryContext, defaultLabel: "authorized-summary" });
  const authorizedSummary = provider();
  assertSummary("authorized", authorizedSummary, { total: 43, optional: 41 });

  assert.throws(() => buildRuntimeRegistrySummary({}), /requires registryContext function/);

  const runtimeStatusTool = createTestMcpRuntimeStatusTool(() => ({
    server: { name: SERVER_NAME, version: SERVER_VERSION },
    runtime: { auth: { mode: "oauth21" }, profile: { mode: "internal" } },
    enabled_tools: authorizedSupport.toolsList().map((tool) => tool.name),
    tool_count: authorizedSupport.toolsList().length,
  }));
  const statusResult = await runtimeStatusTool.execute({ include_tools: false });
  const statusJson = JSON.stringify(statusResult);
  assert.equal(statusJson.includes("runtime_registry_summary"), false, "runtime status must not expose registry summary key");
  assert.equal(statusJson.includes("diff_snapshot_hash"), false, "runtime status must not expose registry diff hash");

  console.log("smoke_runtime_registry_summary ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
