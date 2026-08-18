"use strict";

const assert = require("node:assert/strict");
const { createMcpRuntimeHandlers } = require("../src/runtime/mcp_runtime_handlers");

const MODERN = "2026-07-28";
const OPAQUE_STATE = "mrtr_test_state_012345678901234567890123456789";

function modernMeta() {
  return {
    "io.modelcontextprotocol/protocolVersion": MODERN,
    "io.modelcontextprotocol/clientCapabilities": {},
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
      assert.equal(input.requirement, null, "consent policy must still be dormant in this package");
      assert.equal(input.authContext.clientId, "client-1");
      assert.deepEqual(input.authContext.scopes, ["mcp:tools"]);

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
        assert.deepEqual(input.inputResponses, {
          approval: { action: "accept", content: { confirmed: true } },
        });
        return {
          status: "retry_ready",
          inputResponses: input.inputResponses,
          audit: { reason_code: "mrtr_retry_accepted", state_handle_sha256: "hash-accepted" },
        };
      }
      return {
        status: "input_required",
        result: {
          resultType: "input_required",
          inputRequests: {
            approval: {
              method: "elicitation/create",
              params: {
                mode: "form",
                message: "Approve test mutation",
                requestedSchema: {
                  type: "object",
                  properties: { confirmed: { type: "boolean" } },
                  required: ["confirmed"],
                },
              },
            },
          },
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

  const first = await handlers.handleRpcMessage(toolMessage(1), requestContext("req-mrtr-first"));
  assert.equal(first.error, undefined);
  assert.equal(first.result.resultType, "input_required");
  assert.equal(first.result.requestState, OPAQUE_STATE);
  assert.equal(executions, 0, "initial MRTR round must not execute the tool");
  assert.equal(audit.some((entry) => entry.event === "tool_call_start" && entry.request_id === "req-mrtr-first"), false);

  const retry = await handlers.handleRpcMessage(toolMessage(2, {
    requestState: OPAQUE_STATE,
    inputResponses: {
      approval: { action: "accept", content: { confirmed: true } },
    },
  }), requestContext("req-mrtr-retry"));
  assert.equal(retry.error, undefined);
  assert.equal(retry.result.resultType, "complete");
  assert.equal(executions, 1, "accepted MRTR retry reaches existing execution exactly once");
  assert.equal(audit.some((entry) => entry.event === "tool_call_start" && entry.request_id === "req-mrtr-retry"), true);
  assert.equal(mrtrCalls.length, 2);

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
    inputResponses: { approval: { action: "accept", content: { confirmed: true } } },
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
  const dormant = await dormantHandlers.handleRpcMessage(toolMessage(10), requestContext("req-mrtr-dormant"));
  assert.equal(dormant.error, undefined);
  assert.equal(dormant.result.resultType, "complete");
  assert.equal(dormantExecutions, 1, "production MRTR module is dormant until policy supplies a requirement");

  const serializedAudit = JSON.stringify(audit);
  assert.equal(serializedAudit.includes(OPAQUE_STATE), false, "audit must not contain raw requestState");
  assert.equal(serializedAudit.includes("confirmed"), false, "audit must not contain inputResponses");

  console.log("smoke_mrtr_runtime_integration ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
