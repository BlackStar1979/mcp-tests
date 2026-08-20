"use strict";

const assert = require("node:assert/strict");
const { createMcpRuntimeHandlers } = require("../src/runtime/mcp_runtime_handlers");
const { getToolPolicy } = require("../src/tool_policy");

const MODERN = "2026-07-28";
const OPAQUE_STATE = "mrtr_test_state_012345678901234567890123456789";
const RESPONSE_CANARY = "consent-response-canary-must-not-enter-audit";
const STATE_SHA256 = "a".repeat(64);
const REQUIREMENT_SHA256 = "b".repeat(64);

function modernMeta(clientCapabilities = { elicitation: {} }) {
  return {
    "io.modelcontextprotocol/protocolVersion": MODERN,
    "io.modelcontextprotocol/clientCapabilities": clientCapabilities,
  };
}

function requestContext(requestId) {
  return {
    requestId,
    sessionId: "",
    protocolVersion: MODERN,
    protocolVersionHeader: MODERN,
    requestHeaders: { "mcp-method": "tools/call", "mcp-name": "run_process" },
    authResult: {
      subject: "operator-1",
      clientId: "client-1",
      scopes: ["mcp:tools"],
    },
  };
}

function toolMessage(id, extra = {}) {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      name: "run_process",
      arguments: { command: "node" },
      _meta: modernMeta(),
      ...extra,
    },
  };
}

function createFakeTool(onExecute) {
  return {
    name: "run_process",
    descriptor: {
      name: "run_process",
      inputSchema: {
        type: "object",
        properties: { command: { type: "string", minLength: 1 } },
        required: ["command"],
        additionalProperties: false,
      },
    },
    async execute(args) {
      onExecute(args);
      return { success: true, status: "ok", value: "executed" };
    },
    summarizeArgs() { return { command: "node" }; },
    resultStats() { return { result_count: 1, result_chars: 8 }; },
  };
}

function mrtrFixtureToolPolicyResolver(toolName) {
  const toolPolicy = getToolPolicy(toolName);
  if (toolName !== "run_process" || !toolPolicy) return toolPolicy;
  return { ...toolPolicy, consent_mode: "mrtr_human_approval" };
}

function createHandlers({ mrtrExtension, onExecute, audit }) {
  const fakeTool = createFakeTool(onExecute);
  return createMcpRuntimeHandlers({
    serverName: "test",
    serverVersion: "0.0.0",
    connectorShapeVersion: "shape",
    outputMode: "structured",
    authPolicy: { mode: "oauth21" },
    runtimeProfile: "internal",
    toolIntrospection: () => ({ tools: [], toolNames: [] }),
    toolsList: () => [],
    documentRuntimeContext: () => ({ docs: [] }),
    auditLog(event, fields) { audit.push({ event, ...(fields || {}) }); },
    getOptionalTool(name) { return name === "run_process" ? fakeTool : null; },
    toolPolicyResolver: mrtrFixtureToolPolicyResolver,
    publicBaseUrl: "https://example.invalid",
    rateLimiter: null,
    serverStartId: "start-1",
    disableLegacyInitialize: true,
    ...(mrtrExtension ? { mrtrExtension } : {}),
  });
}

(async () => {
  let executions = 0;
  const audit = [];
  const mrtrCalls = [];
  const fakeMrtr = {
    evaluate(input) {
      mrtrCalls.push({
        toolName: input.toolName,
        protocolVersion: input.protocolVersion,
        requirement: input.requirement,
        hasState: input.requestState !== undefined,
      });
      assert.equal(input.toolName, "run_process");
      assert.equal(input.protocolVersion, MODERN);
      assert.equal(input.requirement?.kind, "human_consent_v1");
      assert.equal(input.requirement?.consent?.response_key, "human_approval");
      assert.equal(input.authContext.clientId, "client-1");
      assert.deepEqual(input.authContext.scopes, ["mcp:tools"]);

      if (!input.clientCapabilities?.elicitation) {
        return {
          status: "missing_client_capability",
          requiredCapabilities: { elicitation: { form: {} } },
          audit: { reason_code: "mrtr_form_elicitation_capability_missing" },
        };
      }
      assert.deepEqual(input.clientCapabilities, { elicitation: {} });

      if (input.requestState === "deny-state") {
        return {
          status: "denied",
          code: "mrtr_state_invalid",
          reason: "state_handle_revoked",
          audit: { reason_code: "state_handle_revoked", state_handle_sha256: "hash-denied" },
        };
      }
      if (input.requestState !== undefined) {
        assert.equal(input.requestState, OPAQUE_STATE);
        assert.deepEqual(Object.keys(input.inputResponses || {}), ["human_approval"]);
        return {
          status: "retry_ready",
          inputResponses: input.inputResponses,
          audit: {
            reason_code: "mrtr_retry_accepted",
            state_handle_sha256: STATE_SHA256,
            requirement_sha256: REQUIREMENT_SHA256,
          },
        };
      }
      return {
        status: "input_required",
        result: {
          resultType: "input_required",
          inputRequests: input.requirement.inputRequests,
          requestState: OPAQUE_STATE,
        },
        audit: { reason_code: "mrtr_input_required", state_handle_sha256: "hash-issued" },
      };
    },
  };

  const handlers = createHandlers({
    mrtrExtension: fakeMrtr,
    onExecute(args) {
      executions += 1;
      assert.equal(args.command, "node");
    },
    audit,
  });

  const missingCapability = await handlers.handleRpcMessage(toolMessage(0, {
    _meta: modernMeta({}),
  }), requestContext("req-mrtr-missing-capability"));
  assert.equal(missingCapability.result, undefined);
  assert.equal(missingCapability.error?.code, -32021);
  assert.deepEqual(missingCapability.error?.data?.requiredCapabilities, {
    elicitation: { form: {} },
  });
  assert.equal(executions, 0, "capability rejection must not execute the tool");
  assert.equal(
    audit.some((entry) => entry.event === "tool_call_start" && entry.request_id === "req-mrtr-missing-capability"),
    false,
  );

  const first = await handlers.handleRpcMessage(toolMessage(1), requestContext("req-mrtr-first"));
  assert.equal(first.error, undefined);
  assert.equal(first.result.resultType, "input_required");
  assert.equal(first.result.requestState, OPAQUE_STATE);
  assert.equal(executions, 0, "initial MRTR round must not execute the tool");
  assert.equal(audit.some((entry) => entry.event === "tool_call_start" && entry.request_id === "req-mrtr-first"), false);

  const retry = await handlers.handleRpcMessage(toolMessage(2, {
    requestState: OPAQUE_STATE,
    inputResponses: {
      human_approval: { action: "accept", content: { confirmed: true } },
    },
  }), requestContext("req-mrtr-retry"));
  assert.equal(retry.error, undefined);
  assert.equal(retry.result.resultType, "complete");
  assert.equal(executions, 1, "accepted MRTR retry reaches existing execution exactly once");
  assert.equal(audit.some((entry) => entry.event === "tool_call_start" && entry.request_id === "req-mrtr-retry"), true);
  const acceptedAuditIndex = audit.findIndex((entry) => entry.event === "tool_call_consent_accepted" && entry.request_id === "req-mrtr-retry");
  const startAuditIndex = audit.findIndex((entry) => entry.event === "tool_call_start" && entry.request_id === "req-mrtr-retry");
  assert.ok(acceptedAuditIndex >= 0, "accepted consent audit must exist");
  assert.ok(acceptedAuditIndex < startAuditIndex, "consent acceptance must be audited before tool execution start");
  const acceptedAudit = audit[acceptedAuditIndex];
  assert.deepEqual(acceptedAudit.consent_receipt, {
    version: "human-consent-receipt-v1",
    outcome: "accepted",
    tool_name: "run_process",
    resource_class: "process_execution_bounded",
    operation_class: "execute",
    risk_class: "high",
    scope_delta: [],
    external_origin: null,
    state_handle_sha256: STATE_SHA256,
    requirement_sha256: REQUIREMENT_SHA256,
    binding_verified: true,
  });
  assert.equal(JSON.stringify(acceptedAudit).includes(OPAQUE_STATE), false);
  assert.equal(JSON.stringify(acceptedAudit).includes("confirmed"), false);
  assert.equal(JSON.stringify(acceptedAudit).includes("arguments_sha256"), false);
  assert.equal(JSON.stringify(acceptedAudit).includes("scope_sha256"), false);
  assert.equal(mrtrCalls.length, 3);

  const deniedSemanticCases = [
    ["false", { action: "accept", content: { confirmed: false } }, "consent_not_confirmed"],
    ["decline", { action: "decline", content: { note: RESPONSE_CANARY } }, "consent_declined"],
    ["cancel", { action: "cancel" }, "consent_cancelled"],
  ];
  for (const [label, response, reason] of deniedSemanticCases) {
    const beforeExecutions = executions;
    const deniedConsent = await handlers.handleRpcMessage(toolMessage(`consent-${label}`, {
      requestState: OPAQUE_STATE,
      inputResponses: { human_approval: response },
    }), requestContext(`req-consent-${label}`));
    assert.equal(deniedConsent.result, undefined, label);
    assert.equal(deniedConsent.error?.code, -32602, label);
    assert.equal(deniedConsent.error?.data?.decision_code, "human_consent_denied", label);
    assert.deepEqual(deniedConsent.error?.data?.reason_codes, [reason], label);
    assert.equal(executions, beforeExecutions, `${label} must not execute`);
    assert.equal(audit.some((entry) => entry.event === "tool_call_start" && entry.request_id === `req-consent-${label}`), false, label);
    assert.equal(audit.some((entry) => entry.event === "tool_call_consent_denied" && entry.request_id === `req-consent-${label}`), true, label);
  }

  const beforeInvalid = mrtrCalls.length;
  const invalid = await handlers.handleRpcMessage({
    ...toolMessage(3),
    params: {
      ...toolMessage(3).params,
      arguments: {},
    },
  }, requestContext("req-mrtr-invalid-input"));
  assert.equal(invalid.result.isError, true, "SEP-1303 invalid tool input remains a tool execution error");
  assert.equal(mrtrCalls.length, beforeInvalid, "input validation must run before MRTR state issuance");
  assert.equal(executions, 1);

  const denied = await handlers.handleRpcMessage(toolMessage(4, {
    requestState: "deny-state",
    inputResponses: { human_approval: { action: "accept", content: { confirmed: true } } },
  }), requestContext("req-mrtr-denied"));
  assert.equal(denied.result, undefined);
  assert.equal(denied.error?.data?.decision_code, "mrtr_state_invalid");
  assert.deepEqual(denied.error?.data?.reason_codes, ["state_handle_revoked"]);
  assert.equal(executions, 1, "denied retry must not execute");

  let dormantExecutions = 0;
  const dormantAudit = [];
  const dormantHandlers = createHandlers({
    onExecute() { dormantExecutions += 1; },
    audit: dormantAudit,
  });
  const productionComposition = await dormantHandlers.handleRpcMessage(toolMessage(10), requestContext("req-mrtr-production-composition"));
  assert.equal(productionComposition.error, undefined);
  assert.equal(productionComposition.result.resultType, "input_required");
  assert.equal(dormantExecutions, 0, "production MRTR composition must gate a consent-classified process call before execution");
  assert.equal(
    dormantAudit.some((entry) => entry.event === "tool_call_start" && entry.request_id === "req-mrtr-production-composition"),
    false,
  );

  const legacySearchContext = {
    ...requestContext("req-legacy-readonly"),
    protocolVersion: "2025-06-18",
    protocolVersionHeader: "2025-06-18",
    requestHeaders: { "mcp-method": "tools/call", "mcp-name": "search" },
  };
  const legacySearch = await dormantHandlers.handleRpcMessage({
    jsonrpc: "2.0",
    id: 11,
    method: "tools/call",
    params: { name: "search", arguments: { query: "nothing" } },
  }, legacySearchContext);
  assert.equal(legacySearch.error, undefined, "legacy unrelated read-only call remains unchanged");
  assert.deepEqual(legacySearch.result.structuredContent.results, []);

  const serializedAudit = JSON.stringify(audit);
  assert.equal(serializedAudit.includes(OPAQUE_STATE), false, "audit must not contain raw requestState");
  assert.equal(serializedAudit.includes("inputResponses"), false, "audit must not contain inputResponses field");
  assert.equal(serializedAudit.includes("human_approval"), false, "audit must not contain consent response key");
  assert.equal(serializedAudit.includes("\"confirmed\":true"), false, "audit must not contain accepted consent content");
  assert.equal(serializedAudit.includes(RESPONSE_CANARY), false, "audit must not contain declined consent content canary");

  console.log("smoke_mrtr_runtime_integration ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
