"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { createRuntimeSupportAssembly } = require("../src/runtime/runtime_support_assembly");
const { configureOptionalToolsAssembly } = require("../src/runtime/optional_tools_assembly");
const { buildPolicyEnforcementCoverageMatrix } = require("../src/policy_enforcement_coverage_matrix");
const {
  POLICY_PREFLIGHT_REASON_CODES,
  assertKnownReasonCodes,
  evaluatePolicyPreflightMatrix,
  getReasonCode,
} = require("../src/policy_preflight_reason_codes");
const { loadServerProfileConfig } = require("../src/server_profile_loader");
const { CONNECTOR_SHAPE_VERSION, SERVER_NAME, SERVER_VERSION, AUDIT_VERSION } = require("../src/runtime/identity");

const ROOT = path.resolve(__dirname, "..");

function makeRuntimeStatusProvider({ authMode, profile }) {
  return () => ({
    server: { name: SERVER_NAME, version: SERVER_VERSION },
    runtime: { auth: { mode: authMode }, profile: { mode: profile } },
  });
}

function buildMatrix({ authMode, runtimeProfile, surfaceName }) {
  const optionalTools = [];
  const support = createRuntimeSupportAssembly({
    auditLogPath: path.join(ROOT, "_logs", `.stage10-policy-reason-codes-${authMode}.jsonl`),
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
    auditLogPath: path.join(ROOT, "_logs", `.stage10-policy-reason-codes-${authMode}-optional.jsonl`),
  });
  return buildPolicyEnforcementCoverageMatrix({
    registryContext: support.registryContext,
    serverProfileConfig,
    surfaceName,
    authMode,
    rootDir: ROOT,
    label: `${surfaceName}-reason-code-preflight`,
  });
}

(() => {
  const expectedCodes = [
    "descriptor_missing_or_mismatch",
    "missing_tool_policy",
    "missing_catalog_entry",
    "resource_class_missing",
    "resource_class_unknown",
    "operation_class_missing",
    "operation_class_unknown",
    "operation_not_allowed_for_resource_class",
    "profile_resource_class_not_allowed",
    "profile_resource_class_denied",
    "public_surface_resource_not_allowed",
    "public_tool_not_public_safe",
    "mutating_operation_without_audit_required",
    "mutating_operation_marked_read_only",
  ].sort();
  assert.deepEqual(Object.keys(POLICY_PREFLIGHT_REASON_CODES).sort(), expectedCodes);
  assert.equal(getReasonCode("operation_not_allowed_for_resource_class").severity, "deny");
  assert.equal(assertKnownReasonCodes(["missing_tool_policy", "operation_class_missing"]), true);
  assert.throws(() => assertKnownReasonCodes(["unknown_future_code"]), /Unknown policy preflight reason codes/);

  const publicDecision = evaluatePolicyPreflightMatrix(buildMatrix({ authMode: "none", runtimeProfile: "public", surfaceName: "public" }));
  assert.equal(publicDecision.schema_version, "stage10-policy-preflight-dry-run-v1");
  assert.equal(publicDecision.mode, "dry_run_only");
  assert.equal(publicDecision.tool_count, 13);
  assert.equal(publicDecision.would_allow_count, 13);
  assert.equal(publicDecision.would_deny_count, 0);
  assert.deepEqual(publicDecision.denied_tools, []);
  assert.equal(publicDecision.runtime_enforcement_changed, false);
  assert.equal(publicDecision.allow_deny_behavior_changed, false);
  assert.equal(publicDecision.connector_visible_schema_changed, false);
  assert.equal(publicDecision.execute_allowed_now, false);

  const authorizedDecision = evaluatePolicyPreflightMatrix(buildMatrix({ authMode: "oauth21", runtimeProfile: "internal", surfaceName: "authenticated" }));
  assert.equal(authorizedDecision.tool_count, 43);
  assert.equal(authorizedDecision.would_allow_count, 40);
  assert.equal(authorizedDecision.would_deny_count, 3);
  assert.deepEqual(authorizedDecision.denied_tools.map((item) => item.tool).sort(), [
    "plugin_catalog_search",
    "plugin_execution_governance",
    "plugin_visibility_status",
  ]);
  for (const denied of authorizedDecision.denied_tools) {
    assert.deepEqual(denied.reason_codes, ["operation_not_allowed_for_resource_class"]);
  }
  const memorySave = authorizedDecision.decisions.find((decision) => decision.tool === "memory_save");
  assert.equal(memorySave.would_allow, true);
  assert.equal(memorySave.would_deny, false);
  assert.equal(memorySave.mutation, true);
  assert.equal(memorySave.audit_required, true);
  assert.equal(authorizedDecision.runtime_enforcement_changed, false);
  assert.equal(authorizedDecision.allow_deny_behavior_changed, false);

  console.log("smoke_stage10_policy_preflight_reason_codes ok");
})();
