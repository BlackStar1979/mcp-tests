"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { createRuntimeSupportAssembly } = require("../src/runtime/runtime_support_assembly");
const { configureOptionalToolsAssembly } = require("../src/runtime/optional_tools_assembly");
const { buildPolicyEnforcementCoverageMatrix } = require("../src/policy_enforcement_coverage_matrix");
const { evaluatePolicyPreflightMatrix } = require("../src/policy_preflight_reason_codes");
const { loadServerProfileConfig } = require("../src/server_profile_loader");
const { CONNECTOR_SHAPE_VERSION, SERVER_NAME, SERVER_VERSION, AUDIT_VERSION } = require("../src/runtime/identity");

const ROOT = path.resolve(__dirname, "..");
const REMEDIATED_TOOLS = [
  "plugin_execution_governance",
  "plugin_visibility_status",
  "plugin_catalog_search",
];

function provider({ authMode, profile }) {
  return () => ({
    server: { name: SERVER_NAME, version: SERVER_VERSION },
    runtime: { auth: { mode: authMode }, profile: { mode: profile } },
  });
}

function buildMatrix({ authMode, runtimeProfile, surfaceName }) {
  const optionalTools = [];
  const support = createRuntimeSupportAssembly({
    auditLogPath: path.join(ROOT, "_logs", `.stage11-gap-remediation-${authMode}.jsonl`),
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
    runtimeStatusProvider: provider({ authMode, profile: runtimeProfile }),
    auditLogPath: path.join(ROOT, "_logs", `.stage11-gap-remediation-${authMode}-optional.jsonl`),
  });
  return buildPolicyEnforcementCoverageMatrix({
    registryContext: support.registryContext,
    serverProfileConfig,
    surfaceName,
    authMode,
    rootDir: ROOT,
    label: `${surfaceName}-stage11-remediation`,
  });
}

(() => {
  const publicMatrix = buildMatrix({ authMode: "none", runtimeProfile: "public", surfaceName: "public" });
  const publicEval = evaluatePolicyPreflightMatrix(publicMatrix);
  assert.equal(publicMatrix.blocked_count, 0);
  assert.equal(publicEval.would_deny_count, 0);
  assert.equal(publicMatrix.runtime_enforcement_changed, false);
  assert.equal(publicEval.runtime_enforcement_changed, false);

  const authorizedMatrix = buildMatrix({ authMode: "oauth21", runtimeProfile: "internal", surfaceName: "authenticated" });
  const authorizedEval = evaluatePolicyPreflightMatrix(authorizedMatrix);
  assert.equal(authorizedMatrix.tool_count, 43);
  assert.equal(authorizedMatrix.blocked_count, 0);
  assert.deepEqual(authorizedMatrix.blocked_tools, []);
  assert.equal(authorizedEval.would_deny_count, 0);
  assert.deepEqual(authorizedEval.denied_tools, []);
  assert.equal(authorizedEval.would_allow_count, 43);

  for (const name of REMEDIATED_TOOLS) {
    const coverage = authorizedMatrix.entries.find((entry) => entry.name === name);
    const decision = authorizedEval.decisions.find((entry) => entry.tool === name);
    assert.ok(coverage, `missing coverage ${name}`);
    assert.ok(decision, `missing decision ${name}`);
    assert.equal(coverage.readiness, "ready_for_preflight", `${name} readiness`);
    assert.deepEqual(coverage.errors, [], `${name} errors`);
    assert.equal(decision.would_allow, true, `${name} would_allow`);
    assert.equal(decision.would_deny, false, `${name} would_deny`);
    assert.deepEqual(decision.reason_codes, [], `${name} reason codes`);
  }

  assert.equal(authorizedMatrix.runtime_enforcement_changed, false);
  assert.equal(authorizedMatrix.allow_deny_behavior_changed, false);
  assert.equal(authorizedMatrix.connector_visible_schema_changed, false);
  assert.equal(authorizedEval.runtime_enforcement_changed, false);
  assert.equal(authorizedEval.allow_deny_behavior_changed, false);
  assert.equal(authorizedEval.connector_visible_schema_changed, false);

  console.log("smoke_stage11_policy_gap_remediation ok");
})();
