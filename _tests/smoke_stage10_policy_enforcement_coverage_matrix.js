"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { createRuntimeSupportAssembly } = require("../src/runtime/runtime_support_assembly");
const { configureOptionalToolsAssembly } = require("../src/runtime/optional_tools_assembly");
const { buildPolicyEnforcementCoverageMatrix } = require("../src/policy_enforcement_coverage_matrix");
const { loadServerProfileConfig } = require("../src/server_profile_loader");
const { CONNECTOR_SHAPE_VERSION, SERVER_NAME, SERVER_VERSION, AUDIT_VERSION } = require("../src/runtime/identity");

const ROOT = path.resolve(__dirname, "..");

function makeRuntimeStatusProvider({ authMode, profile }) {
  return () => ({ server: { name: SERVER_NAME, version: SERVER_VERSION }, runtime: { auth: { mode: authMode }, profile: { mode: profile } } });
}

function buildSupport({ authMode, runtimeProfile }) {
  const optionalTools = [];
  const support = createRuntimeSupportAssembly({ auditLogPath: path.join(ROOT, "_logs", `.stage10-policy-coverage-${authMode}.jsonl`), auditVersion: AUDIT_VERSION, serverName: SERVER_NAME, serverVersion: SERVER_VERSION, connectorShapeVersion: CONNECTOR_SHAPE_VERSION, docs: [], publicBaseUrl: authMode === "none" ? "http://127.0.0.1:3009" : "http://127.0.0.1:3008", maxFetchTextChars: 2500, outputMode: "structured", optionalTools, rootDir: ROOT });
  const serverProfileConfig = loadServerProfileConfig({ profileName: "tests", authMode, rootDir: ROOT });
  configureOptionalToolsAssembly({ optionalTools, profile: runtimeProfile, authPolicy: { mode: authMode, requiresAuth: authMode !== "none" }, serverProfileConfig, runtimeStatusProvider: makeRuntimeStatusProvider({ authMode, profile: runtimeProfile }), auditLogPath: path.join(ROOT, "_logs", `.stage10-policy-coverage-${authMode}-optional.jsonl`) });
  return { support, serverProfileConfig };
}
function assertMatrix(label, matrix, expected) {
  assert.equal(matrix.schema_version, "stage10-policy-enforcement-coverage-matrix-v1", `${label} schema`);
  assert.equal(matrix.mode, "preflight_only", `${label} mode`);
  assert.equal(matrix.runtime_enforcement_changed, false, `${label} enforcement unchanged`);
  assert.equal(matrix.allow_deny_behavior_changed, false, `${label} behavior unchanged`);
  assert.equal(matrix.connector_visible_schema_changed, false, `${label} schema unchanged`);
  assert.equal(matrix.tool_count, expected.total, `${label} tool count`);
  assert.equal(matrix.registry_tool_count, expected.total, `${label} registry tool count`);
  assert.equal(matrix.ready_count, expected.total - (expected.blocked || 0), `${label} ready count`);
  assert.equal(matrix.blocked_count, expected.blocked || 0, `${label} blocked count`);
  if (expected.blocked_names) {
    assert.deepEqual(matrix.blocked_tools.map((item) => item.name).sort(), expected.blocked_names.slice().sort(), `${label} blocked tools`);
  } else {
    assert.deepEqual(matrix.blocked_tools, [], `${label} blocked tools`);
  }
  assert.equal(matrix.policy_model_ok, true, `${label} policy model ok`);
  assert.ok(typeof matrix.diff_snapshot_hash === "string" && matrix.diff_snapshot_hash.length >= 12, `${label} diff hash`);
  for (const name of expected.required) {
    const entry = matrix.entries.find((item) => item.name === name);
    assert.ok(entry, `${label} required entry ${name}`);
    if (!expected.blocked_names || !expected.blocked_names.includes(name)) {
      assert.equal(entry.readiness, "ready_for_preflight", `${label} readiness ${name}`);
      assert.equal(entry.errors.length, 0, `${label} errors ${name}`);
    }
    assert.ok(entry.resource_class, `${label} resource ${name}`);
    assert.ok(entry.operation_class, `${label} operation ${name}`);
  }
}
(() => {
  const pub = buildSupport({ authMode: "none", runtimeProfile: "public" });
  const publicMatrix = buildPolicyEnforcementCoverageMatrix({ registryContext: pub.support.registryContext, serverProfileConfig: pub.serverProfileConfig, surfaceName: "public", authMode: "none", rootDir: ROOT, label: "public-policy-coverage" });
  assertMatrix("public", publicMatrix, { total: 13, required: ["search", "fetch", "fs_list_public", "net_http_get_allowlisted"] });
  assert.equal(publicMatrix.mutating_tool_count, 0, "public has no mutating tools");
  assert.equal(publicMatrix.audit_required_count, 0, "public has no audit-required tools");
  const auth = buildSupport({ authMode: "oauth21", runtimeProfile: "internal" });
  const authMatrix = buildPolicyEnforcementCoverageMatrix({ registryContext: auth.support.registryContext, serverProfileConfig: auth.serverProfileConfig, surfaceName: "authenticated", authMode: "oauth21", rootDir: ROOT, label: "authorized-policy-coverage" });
  assertMatrix("authorized", authMatrix, { total: 43, required: ["test_mcp_runtime_status", "auth_legacy_retirement_status", "memory_save", "plugin_visibility_plan", "plugin_execution_governance", "plugin_visibility_status", "plugin_catalog_search"] });
  assert.ok(authMatrix.mutating_tools.includes("memory_save"), "authorized mutating tool inventory includes memory_save");
  assert.ok(authMatrix.audit_required_tools.includes("memory_save"), "memory_save audit required");
  assert.ok(authMatrix.audit_required_tools.includes("plugin_visibility_plan"), "plugin_visibility_plan audit required");
  assert.equal(authMatrix.runtime_enforcement_changed, false);
  assert.equal(authMatrix.allow_deny_behavior_changed, false);
  assert.equal(authMatrix.connector_visible_schema_changed, false);
  assert.throws(() => buildPolicyEnforcementCoverageMatrix({}), /requires registryContext function/);
  console.log("smoke_stage10_policy_enforcement_coverage_matrix ok");
})();
