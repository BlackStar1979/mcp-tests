"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { createRuntimeSupportAssembly } = require("../src/runtime/runtime_support_assembly");
const { configureOptionalToolsAssembly } = require("../src/runtime/optional_tools_assembly");
const { buildPolicyEnforcementCoverageMatrix } = require("../src/policy_enforcement_coverage_matrix");
const { evaluatePolicyPreflightMatrix } = require("../src/policy_preflight_reason_codes");
const { buildPolicyPreflightReceipts } = require("../src/policy_preflight_receipt");
const { buildEnforcementApplyReadinessReport } = require("../src/enforcement_apply_readiness_report");
const { loadServerProfileConfig } = require("../src/server_profile_loader");
const { CONNECTOR_SHAPE_VERSION, SERVER_NAME, SERVER_VERSION, AUDIT_VERSION } = require("../src/runtime/identity");

const ROOT = path.resolve(__dirname, "..");

function provider({ authMode, profile }) {
  return () => ({
    server: { name: SERVER_NAME, version: SERVER_VERSION },
    runtime: { auth: { mode: authMode }, profile: { mode: profile } },
  });
}

function buildMatrixAndEvaluation({ authMode, runtimeProfile, surfaceName }) {
  const optionalTools = [];
  const support = createRuntimeSupportAssembly({
    auditLogPath: path.join(ROOT, "_logs", `.stage12-apply-readiness-${authMode}.jsonl`),
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
    auditLogPath: path.join(ROOT, "_logs", `.stage12-apply-readiness-${authMode}-optional.jsonl`),
  });
  const matrix = buildPolicyEnforcementCoverageMatrix({
    registryContext: support.registryContext,
    serverProfileConfig,
    surfaceName,
    authMode,
    rootDir: ROOT,
    label: `${surfaceName}-stage12-readiness`,
  });
  return { matrix, evaluation: evaluatePolicyPreflightMatrix(matrix) };
}

(() => {
  const pub = buildMatrixAndEvaluation({ authMode: "none", runtimeProfile: "public", surfaceName: "public" });
  const auth = buildMatrixAndEvaluation({ authMode: "oauth21", runtimeProfile: "internal", surfaceName: "authenticated" });
  const receiptSet = buildPolicyPreflightReceipts({
    evaluation: auth.evaluation,
    profileSurface: "authenticated",
    authMode: "oauth21",
    argsByTool: { memory_save: { content: "secret-value", type: "fact" } },
  });
  const report = buildEnforcementApplyReadinessReport({
    publicMatrix: pub.matrix,
    publicEvaluation: pub.evaluation,
    authorizedMatrix: auth.matrix,
    authorizedEvaluation: auth.evaluation,
    receiptSet,
    remediation: {
      declarative_gaps_removed: true,
      public_blocked_after: 0,
      authorized_blocked_after: 0,
      authorized_would_deny_after: 0,
    },
  });

  assert.equal(report.schema_version, "stage12-enforcement-apply-readiness-report-v1");
  assert.equal(report.mode, "readiness_report_only");
  assert.equal(report.ready_for_operator_review, true);
  assert.equal(report.ready_for_runtime_enforcement, false);
  assert.equal(report.runtime_enforcement_enabled, false);
  assert.equal(report.runtime_enforcement_changed, false);
  assert.equal(report.allow_deny_behavior_changed, false);
  assert.equal(report.connector_visible_schema_changed, false);
  assert.equal(report.operator_approval_required_before_apply, true);
  assert.deepEqual(report.blockers, []);
  assert.equal(report.public.tool_count, 13);
  assert.equal(report.public.blocked_count, 0);
  assert.equal(report.public.would_deny_count, 0);
  assert.equal(report.authorized.tool_count, 43);
  assert.equal(report.authorized.blocked_count, 0);
  assert.equal(report.authorized.would_deny_count, 0);
  assert.equal(report.receipts.receipt_count, 43);
  assert.equal(report.receipts.denied_receipt_count, 0);
  assert.equal(report.receipts.raw_arguments_included, false);
  assert.equal(report.receipts.runtime_audit_event_emitted, false);
  assert.equal(report.remediation.declarative_gaps_removed, true);
  assert.deepEqual(Object.values(report.signals), Object.values(report.signals).map(() => true));
  assert.ok(report.required_operator_approval_for_next_phase.includes("enable_runtime_policy_enforcement"));

  const negative = buildEnforcementApplyReadinessReport({
    publicMatrix: { ...pub.matrix, blocked_count: 1 },
    publicEvaluation: pub.evaluation,
    authorizedMatrix: auth.matrix,
    authorizedEvaluation: auth.evaluation,
    receiptSet,
    remediation: { declarative_gaps_removed: true },
  });
  assert.equal(negative.ready_for_operator_review, false);
  assert.ok(negative.blockers.includes("public_preflight_clear"));
  assert.equal(negative.ready_for_runtime_enforcement, false);

  assert.throws(() => buildEnforcementApplyReadinessReport({}), /requires matrices/);
  console.log("smoke_stage12_enforcement_apply_readiness_report ok");
})();
