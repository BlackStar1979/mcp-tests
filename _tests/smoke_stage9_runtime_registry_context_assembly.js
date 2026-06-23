"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { createRuntimeSupportAssembly } = require("../src/runtime/runtime_support_assembly");
const { configureOptionalToolsAssembly } = require("../src/runtime/optional_tools_assembly");
const { loadServerProfileConfig } = require("../src/server_profile_loader");
const { CONNECTOR_SHAPE_VERSION, SERVER_NAME, SERVER_VERSION, AUDIT_VERSION } = require("../src/runtime/identity");

const ROOT = path.resolve(__dirname, "..");

function makeRuntimeStatusProvider({ authMode, profile }) {
  return () => ({
    server: { name: SERVER_NAME, version: SERVER_VERSION },
    runtime: { auth: { mode: authMode }, profile: { mode: profile } },
  });
}

function buildSupportScenario({ authMode, runtimeProfile }) {
  const optionalTools = [];
  const support = createRuntimeSupportAssembly({
    auditLogPath: path.join(ROOT, "_logs", `.stage9-runtime-registry-${authMode}.jsonl`),
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
  const authPolicy = { mode: authMode, requiresAuth: authMode !== "none" };
  configureOptionalToolsAssembly({
    optionalTools,
    profile: runtimeProfile,
    authPolicy,
    serverProfileConfig,
    runtimeStatusProvider: makeRuntimeStatusProvider({ authMode, profile: runtimeProfile }),
    auditLogPath: path.join(ROOT, "_logs", `.stage9-runtime-registry-${authMode}-optional.jsonl`),
  });

  return { support, optionalTools };
}

function assertScenario(label, authMode, runtimeProfile, expected) {
  const { support, optionalTools } = buildSupportScenario({ authMode, runtimeProfile });
  assert.equal(typeof support.registryContext, "function", `${label} registryContext function`);
  assert.equal(optionalTools.length, expected.optional, `${label} optional tools loaded after support assembly`);

  const context = support.registryContext({ label: `${label}-runtime` });
  const toolsList = support.toolsList();
  assert.equal(context.schema_version, "stage9-runtime-registry-context-v1", `${label} schema`);
  assert.equal(context.registry_snapshot.tool_count, expected.total, `${label} registry count`);
  assert.equal(context.registry_snapshot.core_tool_count, 2, `${label} core count`);
  assert.equal(context.registry_snapshot.optional_tool_count, expected.optional, `${label} optional count`);
  assert.equal(context.policy_read_model.ok, true, `${label} policy read model ok: ${context.policy_read_model.errors.join("; ")}`);
  assert.equal(context.policy_snapshot.missing_tool_policy.length, 0, `${label} missing policies`);
  assert.equal(context.policy_snapshot.missing_catalog_entry.length, 0, `${label} missing catalog`);
  assert.equal(context.diff_snapshot.tool_count, expected.total, `${label} diff snapshot count`);
  assert.deepEqual(toolsList, context.descriptors(), `${label} toolsList remains registry descriptor equivalent`);

  const compact = context.compactSummary();
  assert.equal(compact.tool_count, expected.total, `${label} compact count`);
  assert.equal(compact.policy_model_ok, true, `${label} compact policy ok`);
  assert.equal(compact.policy_error_count, 0, `${label} compact policy errors`);
  assert.equal(typeof compact.diff_snapshot_hash, "string", `${label} diff hash type`);
  assert.ok(compact.diff_snapshot_hash.length >= 12, `${label} diff hash length`);

  for (const name of expected.required) {
    assert.ok(context.get(name), `${label} registry get ${name}`);
    assert.ok(context.getPolicyEntry(name), `${label} policy get ${name}`);
  }
}

(() => {
  assertScenario("public", "none", "public", {
    total: 13,
    optional: 11,
    required: ["search", "fetch", "fs_list_public", "net_http_get_allowlisted"],
  });
  assertScenario("authorized", "oauth21", "internal", {
    total: 43,
    optional: 41,
    required: ["search", "fetch", "test_mcp_runtime_status", "auth_legacy_retirement_status", "memory_save"],
  });

  console.log("smoke_stage9_runtime_registry_context_assembly ok");
})();
