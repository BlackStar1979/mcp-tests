"use strict";

const assert = require("node:assert/strict");
const { validateRpcMessage } = require("../src/runtime/rpc_protocol_validator");
const { getMaxBatchItems } = require("../src/runtime/batch_payload_dispatcher");
const { buildDecisionRuntimeContext } = require("../src/runtime/decision_runtime_context_builder");
const { evaluateDecisionRuntimePolicy } = require("../src/runtime/decision_runtime_policy");

(function requestIdNullRejectedForMcp() {
  const rejected = validateRpcMessage({ jsonrpc: "2.0", id: null, method: "ping" });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, "id_must_be_string_or_number");
})();

(function batchLimitConfigured() {
  assert.equal(getMaxBatchItems(), 25);
})();

(function decisionRuntimePolicyBridgeDeniesNonPublicInPublicProfile() {
  const ctx = buildDecisionRuntimeContext({
    toolName: "code_sample_js",
    args: { path: "server.js", search: "runServerBootstrapRuntime" },
    authMode: "none",
    profile: "public",
    getOptionalTool: () => ({ execute() {} }),
    requestMeta: { requestId: "req-policy-public" },
  });
  assert.equal(ctx.ok, true);
  assert.equal(ctx.context.known_tool, true);
  const decision = evaluateDecisionRuntimePolicy({ decisionContext: ctx });
  assert.equal(decision.allow, false);
  assert.equal(decision.deny_code, "not_public_tool");
})();

(function decisionRuntimePolicyBridgeDeniesAuthRequiredWithoutAuth() {
  const ctx = buildDecisionRuntimeContext({
    toolName: "memory_save",
    args: {},
    authMode: "none",
    profile: "internal",
    getOptionalTool: () => ({ execute() {} }),
    requestMeta: { requestId: "req-policy-auth" },
  });
  assert.equal(ctx.ok, true);
  const decision = evaluateDecisionRuntimePolicy({ decisionContext: ctx });
  assert.equal(decision.allow, false);
  assert.equal(decision.deny_code, "auth_required");
})();

(function decisionRuntimePolicyBridgeAllowsPolicyKnownPublicTool() {
  const ctx = buildDecisionRuntimeContext({
    toolName: "search",
    args: { query: "ok" },
    authMode: "none",
    profile: "public",
    getOptionalTool: () => null,
    requestMeta: { requestId: "req-policy-allow" },
  });
  const decision = evaluateDecisionRuntimePolicy({ decisionContext: ctx });
  assert.equal(decision.allow, true);
  assert.ok(decision.decision_meta.reason_codes.includes("explicit_policy_allow"));
})();

console.log("smoke_mcp_protocol_compliance_guards ok");
