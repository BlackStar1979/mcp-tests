"use strict";

const assert = require("node:assert/strict");
const { validateRpcMessage } = require("../src/runtime/rpc_protocol_validator");
const { getMaxBatchItems } = require("../src/runtime/batch_payload_dispatcher");
const { buildDecisionRuntimeContext } = require("../src/runtime/decision_runtime_context_builder");
const { evaluateDecisionRuntimePolicy } = require("../src/runtime/decision_runtime_policy");
const {
  TASKS_EXTENSION_ID,
  adapterForProtocolVersion,
  extensionsForProtocolVersion,
} = require("../src/runtime/protocol_capability_registry");
const rootSpec = require("../SERVER_SPEC.json");
const protocolSpec = require("../SERVER_PROTOCOL_CAPABILITY_SPEC.json");

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

(function protocolCapabilitiesAreModuleDriven() {
  const modern = adapterForProtocolVersion("2026-07-28");
  assert.equal(modern.era, "modern_2026_07_28");
  assert.equal(modern.modules.transport, "streamable_http_stateless");
  assert.equal(modern.modules.discovery, "server_discover");
  assert.equal(modern.modules.request_state, "explicit_state_handles");
  assert.equal(modern.modules.mrtr, "mrtr_extension");
  assert.deepEqual(extensionsForProtocolVersion("2026-07-28"), [TASKS_EXTENSION_ID]);

  const legacy = adapterForProtocolVersion("2025-11-25");
  assert.equal(legacy.era, "legacy_initialize_compat");
  assert.deepEqual(extensionsForProtocolVersion("2025-11-25"), []);
  assert.equal(adapterForProtocolVersion("2099-01-01"), null);
})();

(function protocolCapabilitySpecIsCanonicalAndModular() {
  assert.equal(rootSpec.spec_refs.protocol_capabilities, "SERVER_PROTOCOL_CAPABILITY_SPEC.json");
  assert.ok(rootSpec.repository_layout_contract.root_policy.active_root_files.includes("SERVER_PROTOCOL_CAPABILITY_SPEC.json"));
  assert.equal(protocolSpec.architecture.runtime_registry, "src/runtime/protocol_capability_registry.js");
  assert.equal(protocolSpec.release_2026_07_28.included_sep_count, 22);
  assert.equal(protocolSpec.release_2026_07_28.classification["SEP-2663"].s, "live_optional_module");
  assert.equal(protocolSpec.release_2026_07_28.classification["SEP-1865"].s, "optional_module_not_loaded");
  assert.equal(protocolSpec.release_2026_07_28.classification["SEP-2322"].s, "live_optional_module");
  assert.equal(protocolSpec.release_2026_07_28.classification["SEP-2164"].s, "live_aligned");
  assert.equal(protocolSpec.other_final_sep_dispositions.aligned["SEP-1303"], "tool_input_validation_result");
  assert.equal(protocolSpec.deployment_and_activation_queue[0].runtime_status, "live_accepted");
  assert.equal(protocolSpec.deployment_and_activation_queue[1].runtime_status, "live_accepted");
  assert.equal(protocolSpec.deployment_and_activation_queue[2].repo_status, "implemented");
  assert.equal(protocolSpec.deployment_and_activation_queue[2].runtime_status, "live_accepted");
  assert.equal(protocolSpec.deployment_and_activation_queue[2].surface_change, false);
  assert.ok(protocolSpec.release_2026_07_28.evidence.mrtr.includes("src/runtime/mrtr_extension.js"));
  assert.ok(protocolSpec.release_2026_07_28.evidence.mrtr.includes("_workflow/operator_decisions/mrtr_runtime_closeout.md"));
  assert.deepEqual(protocolSpec.next_queue.slice(0, 2), [
    "POL-1A-CONSENT on MRTR",
    "POL-1A-PROMPT-CONTENT",
  ]);
})();

console.log("smoke_mcp_protocol_compliance_guards ok");
