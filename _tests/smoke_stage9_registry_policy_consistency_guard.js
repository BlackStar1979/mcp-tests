"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { createRuntimeSupportAssembly } = require("../src/runtime/runtime_support_assembly");
const { configureOptionalToolsAssembly } = require("../src/runtime/optional_tools_assembly");
const { buildToolSurfaceFingerprint } = require("../src/schema_compat");
const { loadServerProfileConfig } = require("../src/server_profile_loader");
const { createTestMcpRuntimeStatusTool } = require("../tools/authorized/test_mcp_runtime_status");
const { CONNECTOR_SHAPE_VERSION, SERVER_NAME, SERVER_VERSION, AUDIT_VERSION } = require("../src/runtime/identity");

const ROOT = path.resolve(__dirname, "..");

const EXPECTED = {
  public: {
    authMode: "none",
    runtimeProfile: "public",
    total: 13,
    optional: 11,
    required: ["search", "fetch", "fs_list_public", "net_http_get_allowlisted"],
    forbidden: ["memory_save", "test_mcp_runtime_status", "plugin_visibility_plan"],
  },
  authorized: {
    authMode: "oauth21",
    runtimeProfile: "internal",
    total: 43,
    optional: 41,
    required: ["search", "fetch", "test_mcp_runtime_status", "auth_legacy_retirement_status", "memory_save", "plugin_visibility_plan"],
    forbidden: [],
  },
};

function makeRuntimeStatusProvider({ authMode, profile }) {
  return () => ({
    server: { name: SERVER_NAME, version: SERVER_VERSION },
    runtime: { auth: { mode: authMode }, profile: { mode: profile } },
  });
}

function buildSupport({ authMode, runtimeProfile }) {
  const optionalTools = [];
  const support = createRuntimeSupportAssembly({
    auditLogPath: path.join(ROOT, "_logs", `.stage9-policy-consistency-${authMode}.jsonl`),
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
    auditLogPath: path.join(ROOT, "_logs", `.stage9-policy-consistency-${authMode}-optional.jsonl`),
  });
  return support;
}

function assertScenario(label, expected) {
  const support = buildSupport({ authMode: expected.authMode, runtimeProfile: expected.runtimeProfile });
  const context = support.registryContext({ label: `${label}-policy-consistency` });
  const descriptors = context.descriptors();
  const names = context.names();
  const surface = buildToolSurfaceFingerprint(descriptors);
  const policySnapshot = context.policy_snapshot;
  const compact = context.compactSummary();

  assert.equal(descriptors.length, expected.total, `${label} descriptor count`);
  assert.equal(names.length, expected.total, `${label} name count`);
  assert.equal(context.registry_snapshot.tool_count, expected.total, `${label} registry count`);
  assert.equal(context.registry_snapshot.optional_tool_count, expected.optional, `${label} optional count`);
  assert.equal(surface.tool_count, expected.total, `${label} surface count`);
  assert.equal(compact.tool_count, expected.total, `${label} compact count`);
  assert.equal(compact.policy_model_ok, true, `${label} compact policy ok`);
  assert.equal(policySnapshot.ok, true, `${label} policy snapshot ok: ${policySnapshot.errors.join("; ")}`);
  assert.deepEqual(policySnapshot.missing_tool_policy, [], `${label} missing tool policy`);
  assert.deepEqual(policySnapshot.missing_catalog_entry, [], `${label} missing catalog`);
  assert.deepEqual(policySnapshot.errors, [], `${label} policy errors`);
  assert.equal(context.diff_snapshot.tool_count, expected.total, `${label} diff snapshot count`);

  assert.equal(surface.tool_names_hash, buildToolSurfaceFingerprint(context.registry.descriptors()).tool_names_hash, `${label} fingerprint stable through registry`);

  for (const name of expected.required) {
    const entry = context.getPolicyEntry(name);
    assert.ok(entry, `${label} missing required read-model entry ${name}`);
    assert.equal(entry.name, name, `${label} entry name ${name}`);
    assert.equal(entry.descriptor_summary.name, name, `${label} descriptor summary ${name}`);
    assert.equal(entry.catalog_summary.name, name, `${label} catalog summary ${name}`);
    assert.ok(entry.tool_policy_summary, `${label} policy summary ${name}`);
  }
  for (const name of expected.forbidden) {
    assert.equal(names.includes(name), false, `${label} forbidden tool visible ${name}`);
    assert.equal(context.getPolicyEntry(name), null, `${label} forbidden policy entry visible ${name}`);
  }

  const publicEntries = context.policy_read_model.entries().filter((entry) => entry.catalog_summary?.surface_class === "public_mcp_tools");
  for (const entry of publicEntries) {
    assert.equal(entry.tool_policy_summary.public_safe, true, `${label} public catalog tool must be public_safe: ${entry.name}`);
  }

  return { names, surface };
}

(() => {
  const publicResult = assertScenario("public", EXPECTED.public);
  const authorizedResult = assertScenario("authorized", EXPECTED.authorized);

  assert.equal(publicResult.surface.tool_names_hash.length, 16, "public hash length");
  assert.equal(authorizedResult.surface.tool_names_hash.length, 16, "authorized hash length");
  assert.notEqual(publicResult.surface.tool_names_hash, authorizedResult.surface.tool_names_hash, "public/authorized tool names hash must differ");
  for (const publicName of publicResult.names) {
    assert.ok(authorizedResult.names.includes(publicName), `authorized surface should include public/core-safe tool ${publicName}`);
  }

  console.log("smoke_stage9_registry_policy_consistency_guard ok");
})();
