"use strict";

const assert = require("node:assert/strict");
const { createMcpRuntimeHandlers } = require("../src/runtime/mcp_runtime_handlers");
const { handleToolsCall } = require("../src/runtime/tools_call_handler");
const { dispatchRpcMessage } = require("../src/runtime/rpc_message_dispatcher");
const { runProcessTool } = require("../tools/run_process");
const { TASKS_EXTENSION_ID } = require("../src/runtime/mcp_tasks_extension");
const { createMrtrExtension } = require("../src/runtime/mrtr_extension");
const { resolveTraceContext } = require("../src/runtime/trace_context");

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const UPSTREAM_SPAN_ID = "00f067aa0ba902b7";
const TRACEPARENT = `00-${TRACE_ID}-${UPSTREAM_SPAN_ID}-01`;
const BAGGAGE_SECRET = "secret-never-persist-this";

function modernMeta(traceparent = TRACEPARENT) {
  return {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {},
    traceparent,
    tracestate: "vendor=value",
    baggage: `token=${BAGGAGE_SECRET}`,
  };
}

function taskStatus(overrides = {}) {
  return {
    job_id: "trace-task-1",
    status: "running",
    terminal: false,
    command: "fixture",
    family: "runtime",
    resolution_class: "fixture",
    cwd: ".",
    workspace: "mcp-tests",
    queue_position: null,
    created_at: "2026-08-14T12:00:00.000Z",
    started_at: "2026-08-14T12:00:00.100Z",
    finished_at: null,
    duration_ms: 100,
    timeout_ms: 5000,
    output_limit_chars: 10000,
    stdout_chars: 0,
    stderr_chars: 0,
    stdout_truncated: false,
    stderr_truncated: false,
    exit_code: null,
    signal: null,
    timed_out: false,
    error: null,
    durable: true,
    recovered_after_restart: false,
    ...overrides,
  };
}

function dispatcherArgs(context, prelude) {
  return {
    prelude,
    context,
    serverName: "test",
    serverVersion: "0.0.0",
    connectorShapeVersion: "shape",
    outputMode: "structured",
    authMode: "oauth21",
    profile: "internal",
    tools: [],
    documentRuntimeContext: () => ({ docs: [] }),
    auditLog() {},
    getOptionalTool() { return null; },
    rateLimiter: null,
    serverStartId: "start-1",
    disableLegacyInitialize: false,
  };
}

(async () => {
  const audit = [];
  const handlers = createMcpRuntimeHandlers({
    serverName: "test",
    serverVersion: "0.0.0",
    connectorShapeVersion: "shape",
    outputMode: "structured",
    authPolicy: { mode: "oauth21" },
    runtimeProfile: "internal",
    toolIntrospection: () => ({ tools: [], toolNames: [] }),
    toolsList: () => [],
    documentRuntimeContext: () => ({ docs: [] }),
    auditLog(event, fields) { audit.push({ event, ...fields }); },
    getOptionalTool() { return null; },
    publicBaseUrl: "https://example.invalid",
    rateLimiter: null,
    serverStartId: "start-1",
    disableLegacyInitialize: true,
  });

  const discoverMessage = {
    jsonrpc: "2.0",
    id: 1,
    method: "server/discover",
    params: { _meta: modernMeta() },
  };
  const discover = await handlers.handleRpcMessage(discoverMessage, {
    requestId: "req-trace-valid",
    sessionId: "",
    protocolVersion: "2026-07-28",
    protocolVersionHeader: "2026-07-28",
    requestHeaders: { "mcp-method": "server/discover" },
    authResult: { clientId: "client-a" },
  });
  assert.equal(discover.error, undefined);
  const validAudit = audit.find((entry) => entry.event === "trace_context_resolved" && entry.request_id === "req-trace-valid");
  assert.equal(validAudit.trace_id, TRACE_ID);
  assert.equal(validAudit.parent_span_id, UPSTREAM_SPAN_ID);
  assert.equal(validAudit.trace_source, "incoming");
  assert.equal(validAudit.baggage_present, true);
  assert.equal(JSON.stringify(validAudit).includes(BAGGAGE_SECRET), false);
  assert.equal(JSON.stringify(audit).includes(BAGGAGE_SECRET), false);

  const invalidMessage = {
    jsonrpc: "2.0",
    id: 2,
    method: "server/discover",
    params: { _meta: modernMeta("00-00000000000000000000000000000000-00f067aa0ba902b7-01") },
  };
  const invalidResponse = await handlers.handleRpcMessage(invalidMessage, {
    requestId: "req-trace-invalid",
    sessionId: "",
    protocolVersion: "2026-07-28",
    protocolVersionHeader: "2026-07-28",
    requestHeaders: { "mcp-method": "server/discover" },
    authResult: { clientId: "client-a" },
  });
  assert.equal(invalidResponse.error, undefined, "invalid trace context must not fail the MCP business request");
  const invalidAudit = audit.find((entry) => entry.event === "trace_context_resolved" && entry.request_id === "req-trace-invalid");
  assert.equal(invalidAudit.trace_source, "invalid_generated");
  assert.equal(invalidAudit.trace_context_invalid_reason, "trace_id_all_zero");

  const requestTrace = resolveTraceContext({ traceparent: TRACEPARENT, baggage: `token=${BAGGAGE_SECRET}` });
  let executionTrace = null;
  const taskAudit = [];
  const manager = {
    start(args, owner, executionContext) {
      assert.equal(args.command, "fixture");
      assert.equal(owner.ownerId, "client-a");
      executionTrace = executionContext.traceContext;
      return taskStatus();
    },
    status() {
      return taskStatus({
        status: "ok",
        terminal: true,
        finished_at: "2026-08-14T12:00:01.000Z",
        exit_code: 0,
      });
    },
    trace() {
      return {
        trace_id: executionTrace.traceId,
        span_id: executionTrace.spanId,
        parent_span_id: executionTrace.parentSpanId,
        trace_flags: executionTrace.traceFlags,
        trace_source: executionTrace.source,
      };
    },
    output() {
      return {
        stdout: "done\n",
        stderr: "",
        stdout_next_offset: 5,
        stderr_next_offset: 0,
        stdout_eof: true,
        stderr_eof: true,
        terminal: true,
        status: "ok",
      };
    },
  };
  const taskContext = {
    requestId: "req-task-trace",
    protocolVersion: "2026-07-28",
    requestMetadata: {
      protocolVersion: "2026-07-28",
      clientCapabilities: { elicitation: {}, extensions: { [TASKS_EXTENSION_ID]: {} } },
    },
    traceContext: requestTrace,
    authResult: { clientId: "client-a", scopes: ["mcp:tools"] },
    processJobManager: manager,
  };
  const mrtrExtension = createMrtrExtension();
  const processArgs = { command: "fixture", timeout_ms: 5000 };
  const consentRound = await handleToolsCall({
    id: 3,
    params: { name: "run_process", arguments: processArgs },
    context: taskContext,
    outputMode: "structured",
    documentRuntimeContext: () => ({ docs: [] }),
    auditLog(event, fields) { taskAudit.push({ event, ...fields }); },
    authMode: "oauth21",
    profile: "internal",
    getOptionalTool(name) { return name === "run_process" ? runProcessTool : null; },
    rateLimiter: null,
    mrtrExtension,
  });
  assert.equal(consentRound.result.resultType, "input_required");
  assert.equal(executionTrace, null, "trace execution must not start before human consent");

  const taskStart = await handleToolsCall({
    id: 30,
    params: {
      name: "run_process",
      arguments: processArgs,
      requestState: consentRound.result.requestState,
      inputResponses: {
        human_approval: { action: "accept", content: { confirmed: true } },
      },
    },
    context: taskContext,
    outputMode: "structured",
    documentRuntimeContext: () => ({ docs: [] }),
    auditLog(event, fields) { taskAudit.push({ event, ...fields }); },
    authMode: "oauth21",
    profile: "internal",
    getOptionalTool(name) { return name === "run_process" ? runProcessTool : null; },
    rateLimiter: null,
    mrtrExtension,
  });
  assert.equal(taskStart.result.resultType, "task");
  assert.equal(executionTrace.traceId, requestTrace.traceId);
  assert.equal(executionTrace.parentSpanId, requestTrace.spanId);
  assert.notEqual(executionTrace.spanId, requestTrace.spanId);
  assert.equal(JSON.stringify(taskAudit).includes(BAGGAGE_SECRET), false);

  const completed = await dispatchRpcMessage(dispatcherArgs(taskContext, {
    id: 4,
    method: "tasks/get",
    params: { taskId: "trace-task-1" },
  }));
  assert.equal(completed.result.status, "completed");
  assert.equal(completed.result.result.structuredContent.trace_id, TRACE_ID);

  console.log("smoke_w3c_trace_runtime_integration ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
