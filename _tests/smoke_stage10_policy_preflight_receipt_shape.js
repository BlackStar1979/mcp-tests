"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { createRuntimeSupportAssembly } = require("../src/runtime/runtime_support_assembly");
const { configureOptionalToolsAssembly } = require("../src/runtime/optional_tools_assembly");
const { buildPolicyEnforcementCoverageMatrix } = require("../src/policy_enforcement_coverage_matrix");
const { evaluatePolicyPreflightMatrix } = require("../src/policy_preflight_reason_codes");
const { buildPolicyPreflightReceipt, buildPolicyPreflightReceipts, summarizeArgumentShape } = require("../src/policy_preflight_receipt");
const { loadServerProfileConfig } = require("../src/server_profile_loader");
const { CONNECTOR_SHAPE_VERSION, SERVER_NAME, SERVER_VERSION, AUDIT_VERSION } = require("../src/runtime/identity");

const ROOT = path.resolve(__dirname, "..");
function provider({ authMode, profile }) { return () => ({ server: { name: SERVER_NAME, version: SERVER_VERSION }, runtime: { auth: { mode: authMode }, profile: { mode: profile } } }); }
function buildEval() {
  const optionalTools = [];
  const support = createRuntimeSupportAssembly({ auditLogPath: path.join(ROOT, "_logs", ".stage10-policy-receipt.jsonl"), auditVersion: AUDIT_VERSION, serverName: SERVER_NAME, serverVersion: SERVER_VERSION, connectorShapeVersion: CONNECTOR_SHAPE_VERSION, docs: [], publicBaseUrl: "http://127.0.0.1:3008", maxFetchTextChars: 2500, outputMode: "structured", optionalTools, rootDir: ROOT });
  const serverProfileConfig = loadServerProfileConfig({ profileName: "tests", authMode: "oauth21", rootDir: ROOT });
  configureOptionalToolsAssembly({ optionalTools, profile: "internal", authPolicy: { mode: "oauth21", requiresAuth: true }, serverProfileConfig, runtimeStatusProvider: provider({ authMode: "oauth21", profile: "internal" }), auditLogPath: path.join(ROOT, "_logs", ".stage10-policy-receipt-optional.jsonl") });
  const matrix = buildPolicyEnforcementCoverageMatrix({ registryContext: support.registryContext, serverProfileConfig, surfaceName: "authenticated", authMode: "oauth21", rootDir: ROOT, label: "receipt-shape" });
  return evaluatePolicyPreflightMatrix(matrix);
}
function assertNoRawSecrets(value) {
  const text = JSON.stringify(value);
  for (const forbidden of ["super-secret-token", "SECRET_PATH_VALUE", "raw@example.test", "4111111111111111"]) {
    assert.equal(text.includes(forbidden), false, `receipt leaked raw value: ${forbidden}`);
  }
}

(() => {
  const evaluation = buildEval();
  const allowed = evaluation.decisions.find((decision) => decision.tool === "memory_save");
  assert.ok(allowed);
  const denied = {
    schema_version: "stage10-policy-preflight-entry-v1",
    tool: "synthetic_policy_gap",
    would_allow: false,
    would_deny: true,
    reason_codes: ["operation_not_allowed_for_resource_class"],
    resource_class: "plugin_execution_readonly",
    operation_class: "unsupported_future_operation",
    surface_class: "authorized_mcp_tools",
    mutation: false,
    audit_required: true,
  };
  const sensitiveArgs = { token: "super-secret-token", path: "SECRET_PATH_VALUE", email: "raw@example.test", card: "4111111111111111", nested: { alpha: "beta", count: 3 }, list: ["x", 1, true] };
  const receipt = buildPolicyPreflightReceipt({ decision: denied, profileSurface: "authenticated", authMode: "oauth21", requestId: "r-10-3", args: sensitiveArgs });
  assert.equal(receipt.schema_version, "stage10-policy-preflight-receipt-v1");
  assert.equal(receipt.mode, "dry_run_only");
  assert.equal(receipt.tool, "synthetic_policy_gap");
  assert.equal(receipt.would_deny, true);
  assert.equal(receipt.would_allow, false);
  assert.deepEqual(receipt.reason_codes, ["operation_not_allowed_for_resource_class"]);
  assert.equal(receipt.raw_arguments_included, false);
  assert.equal(receipt.runtime_audit_event_emitted, false);
  assert.equal(receipt.runtime_enforcement_changed, false);
  assert.equal(receipt.allow_deny_behavior_changed, false);
  assert.equal(receipt.connector_visible_schema_changed, false);
  assert.equal(receipt.arg_summary.raw_values_included, false);
  assert.equal(receipt.arg_summary.arg_key_count, 6);
  assert.ok(typeof receipt.receipt_hash === "string" && receipt.receipt_hash.length === 16);
  assertNoRawSecrets(receipt);
  const allowedReceipt = buildPolicyPreflightReceipt({ decision: allowed, profileSurface: "authenticated", authMode: "oauth21", args: { content: "super-secret-token", type: "fact" } });
  assert.equal(allowedReceipt.tool, "memory_save");
  assert.equal(allowedReceipt.would_allow, true);
  assert.equal(allowedReceipt.would_deny, false);
  assert.deepEqual(allowedReceipt.reason_codes, []);
  assert.equal(allowedReceipt.mutation, true);
  assert.equal(allowedReceipt.audit_required, true);
  assertNoRawSecrets(allowedReceipt);
  const receiptSet = buildPolicyPreflightReceipts({ evaluation, profileSurface: "authenticated", authMode: "oauth21", argsByTool: { memory_save: { content: "super-secret-token" } } });
  assert.equal(receiptSet.schema_version, "stage10-policy-preflight-receipt-set-v1");
  assert.equal(receiptSet.receipt_count, 43);
  assert.equal(receiptSet.denied_receipt_count, 0);
  assert.equal(receiptSet.raw_arguments_included, false);
  assert.equal(receiptSet.runtime_audit_event_emitted, false);
  assert.equal(receiptSet.runtime_enforcement_changed, false);
  assertNoRawSecrets(receiptSet);
  const shape = summarizeArgumentShape({ a: 1, b: "two", c: [1, "x"], d: { z: true } });
  assert.equal(shape.arg_key_count, 4);
  assert.equal(shape.raw_values_included, false);
  assert.deepEqual(shape.arg_keys, ["a", "b", "c", "d"]);
  assert.throws(() => buildPolicyPreflightReceipt({}), /requires decision object/);
  assert.throws(() => buildPolicyPreflightReceipts({}), /requires evaluation decisions/);
  console.log("smoke_stage10_policy_preflight_receipt_shape ok");
})();
