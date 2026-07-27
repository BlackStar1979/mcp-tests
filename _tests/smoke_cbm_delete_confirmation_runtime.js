"use strict";

const assert = require("node:assert/strict");
const schemas = require("../src/schemas/codebase_memory_tools");
const { handleToolsCall } = require("../src/runtime/tools_call_handler");
const {
  resetDefaultDestructiveToolConfirmationManagerForTests,
} = require("../src/runtime/destructive_tool_confirmation");

function bridgeResult() {
  return {
    success: true,
    error_code: "",
    error: "",
    cbm_tool: "delete_project",
    duration_ms: 1,
    queue_wait_ms: 0,
    execution_ms: 1,
    binary_version: "0.9.0",
    compatibility_status: "compatible",
    partial_success: false,
    warnings: [],
    timed_out: false,
    exit_code: 0,
    signal: null,
    stdout_truncated: false,
    stderr_truncated: false,
    diagnostic: "",
    result: { deleted: true },
  };
}

(async () => {
  resetDefaultDestructiveToolConfirmationManagerForTests({ now: () => 1000, ttlMs: 120000 });
  let executionCount = 0;
  const optionalTool = {
    name: "cbm_delete_project",
    descriptor: {
      name: "cbm_delete_project",
      inputSchema: schemas.CBM_DELETE_PROJECT_INPUT_SCHEMA,
      outputSchema: schemas.CBM_BRIDGE_OUTPUT_SCHEMA,
    },
    async execute(args) {
      executionCount += 1;
      assert.deepEqual(args, {
        project: "fixture-project",
        confirm: true,
        state_handle: args.state_handle,
      });
      return bridgeResult();
    },
    summarizeArgs() { return { operation: "cbm_delete_project" }; },
    resultStats() { return { result_count: 1 }; },
  };
  const getOptionalTool = (name) => name === "cbm_delete_project" ? optionalTool : null;
  const auditEvents = [];
  const auditLog = (event, payload) => auditEvents.push({ event, payload });
  const authA = { subject: "operator-a", clientId: "client-a", scopes: ["mcp:tools"] };
  const authB = { subject: "operator-b", clientId: "client-a", scopes: ["mcp:tools"] };

  const challengeResponse = await handleToolsCall({
    id: 1,
    params: { name: "cbm_delete_project", arguments: { project: "fixture-project" } },
    context: { requestId: "request-1", authResult: authA },
    outputMode: "structured",
    documentRuntimeContext: null,
    auditLog,
    authMode: "oauth21",
    profile: "internal",
    getOptionalTool,
    rateLimiter: null,
  });
  assert.equal(challengeResponse.error.data.decision_code, "cbm_confirmation_required");
  const handle = challengeResponse.error.data.state_handle;
  assert.equal(typeof handle, "string");
  assert.ok(handle.length > 20);
  assert.equal(executionCount, 0);

  const wrongSubject = await handleToolsCall({
    id: 2,
    params: {
      name: "cbm_delete_project",
      arguments: { project: "fixture-project", confirm: true, state_handle: handle },
    },
    context: { requestId: "request-2", authResult: authB },
    outputMode: "structured",
    documentRuntimeContext: null,
    auditLog,
    authMode: "oauth21",
    profile: "internal",
    getOptionalTool,
    rateLimiter: null,
  });
  assert.equal(wrongSubject.error.data.decision_code, "cbm_confirmation_invalid");
  assert.equal(executionCount, 0);

  const approved = await handleToolsCall({
    id: 3,
    params: {
      name: "cbm_delete_project",
      arguments: { project: "fixture-project", confirm: true, state_handle: handle },
    },
    context: { requestId: "request-3", authResult: authA },
    outputMode: "structured",
    documentRuntimeContext: null,
    auditLog,
    authMode: "oauth21",
    profile: "internal",
    getOptionalTool,
    rateLimiter: null,
  });
  assert.equal(Boolean(approved.result), true);
  assert.equal(executionCount, 1);
  assert.equal(JSON.stringify(auditEvents).includes(handle), false);

  const replay = await handleToolsCall({
    id: 4,
    params: {
      name: "cbm_delete_project",
      arguments: { project: "fixture-project", confirm: true, state_handle: handle },
    },
    context: { requestId: "request-4", authResult: authA },
    outputMode: "structured",
    documentRuntimeContext: null,
    auditLog,
    authMode: "oauth21",
    profile: "internal",
    getOptionalTool,
    rateLimiter: null,
  });
  assert.equal(replay.error.data.decision_code, "cbm_confirmation_invalid");
  assert.equal(executionCount, 1);

  console.log("smoke_cbm_delete_confirmation_runtime ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
