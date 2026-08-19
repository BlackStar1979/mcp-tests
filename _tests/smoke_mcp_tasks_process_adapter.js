"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { handleToolsCall } = require("../src/runtime/tools_call_handler");
const { dispatchRpcMessage } = require("../src/runtime/rpc_message_dispatcher");
const { runProcessTool } = require("../tools/run_process");
const { processStartTool } = require("../tools/process_start");
const { TASKS_EXTENSION_ID } = require("../src/runtime/mcp_tasks_extension");
const { validateModernHttpHeaders } = require("../src/runtime/request_metadata_policy");
const { createProcessJobManager } = require("../src/util/process_job_manager");
const { PROCESS_RUNNER_CONFIG } = require("../src/util/process_runner_config");
const { createMrtrExtension } = require("../src/runtime/mrtr_extension");

const taskCaps = { elicitation: {}, extensions: { [TASKS_EXTENSION_ID]: {} } };

function acceptedConsentParams(params, initial) {
  return {
    ...params,
    requestState: initial.result.requestState,
    inputResponses: {
      human_approval: { action: "accept", content: { confirmed: true } },
    },
  };
}

function status(overrides = {}) {
  return {
    job_id: "job-task-1",
    status: "running",
    terminal: false,
    command: "node",
    family: "runtime",
    resolution_class: "runtime",
    cwd: ".",
    workspace: "mcp-tests",
    queue_position: null,
    created_at: "2026-08-14T07:00:00.000Z",
    started_at: "2026-08-14T07:00:00.100Z",
    finished_at: null,
    duration_ms: 100,
    timeout_ms: 5000,
    output_limit_chars: 250000,
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

function finalResult(overrides = {}) {
  return {
    status: "ok",
    command: "node",
    cwd: ".",
    workspace: "mcp-tests",
    exit_code: 0,
    signal: null,
    timed_out: false,
    duration_ms: 120,
    stdout: "done\n",
    stderr: "",
    stdout_truncated: false,
    stderr_truncated: false,
    output_limit_chars: 250000,
    trace_id: null,
    error: null,
    args: [],
    ...overrides,
  };
}

async function waitFor(predicate, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

function dispatchArgs(context, prelude) {
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
  let syncRunExecutions = 0;
  let processStartExecutions = 0;
  let durableStarts = 0;
  const mrtrExtension = createMrtrExtension();

  const manager = {
    start(args, owner) {
      durableStarts += 1;
      assert.equal(owner.ownerId, "client-a");
      assert.equal(args.command, "node");
      return status();
    },
    status(taskId, owner) {
      assert.equal(taskId, "job-task-1");
      assert.equal(owner.ownerId, "client-a");
      return status();
    },
    output(taskId, cursor, owner) {
      assert.equal(taskId, "job-task-1");
      assert.equal(owner.ownerId, "client-a");
      assert.equal(cursor.stdout_offset, 0);
      assert.equal(cursor.stderr_offset, 0);
      return {
        stdout: "done\n",
        stderr: "",
        stdout_offset: 0,
        stderr_offset: 0,
        stdout_next_offset: 5,
        stderr_next_offset: 0,
        stdout_eof: true,
        stderr_eof: true,
        terminal: true,
        status: "ok",
      };
    },
    async cancel(taskId, reason, owner) {
      assert.equal(taskId, "job-task-1");
      assert.equal(reason, "mcp_tasks_cancel");
      assert.equal(owner.ownerId, "client-a");
      return status({ status: "cancelled", terminal: true, finished_at: "2026-08-14T07:00:00.200Z" });
    },
  };

  const taskContext = {
    requestId: "req-task",
    protocolVersion: "2026-07-28",
    requestMetadata: { protocolVersion: "2026-07-28", clientCapabilities: taskCaps },
    authResult: { clientId: "client-a", scopes: ["mcp:tools"] },
    processJobManager: manager,
  };

  const fakeRunProcessTool = {
    ...runProcessTool,
    execute(args = {}) {
      syncRunExecutions += 1;
      return finalResult({ trace_id: args.trace_id ?? null });
    },
  };
  const fakeProcessStartTool = {
    ...processStartTool,
    execute() {
      processStartExecutions += 1;
      return status();
    },
  };
  const getOptionalTool = (name) => name === "run_process"
    ? fakeRunProcessTool
    : name === "process_start" ? fakeProcessStartTool : null;
  const callProcessTool = ({ id, name, arguments: args, context = taskContext, extraParams = {} }) => handleToolsCall({
    id,
    params: { name, arguments: args, ...extraParams },
    context,
    outputMode: "structured",
    documentRuntimeContext: () => ({ docs: [] }),
    auditLog() {},
    authMode: "oauth21",
    profile: "internal",
    getOptionalTool,
    rateLimiter: null,
    mrtrExtension,
  });

  const taskArgs = { command: "node", args: [], timeout_ms: 5000 };
  const taskConsent = await callProcessTool({ id: 1, name: "run_process", arguments: taskArgs });
  assert.equal(taskConsent.result.resultType, "input_required");
  assert.equal(syncRunExecutions, 0);
  assert.equal(durableStarts, 0, "consent prompt must precede durable Task creation");

  const taskStart = await callProcessTool({
    id: 11,
    name: "run_process",
    arguments: taskArgs,
    extraParams: acceptedConsentParams({}, taskConsent),
  });
  assert.equal(taskStart.result.resultType, "task");
  assert.equal(taskStart.result.taskId, "job-task-1");
  assert.equal(syncRunExecutions, 0);
  assert.equal(durableStarts, 1);

  const asyncArgs = { command: "node", timeout_ms: 5000 };
  const customAsyncConsent = await callProcessTool({ id: 2, name: "process_start", arguments: asyncArgs });
  assert.equal(customAsyncConsent.result.resultType, "input_required");
  assert.equal(processStartExecutions, 0, "consent prompt must precede process_start execution");

  const customAsync = await callProcessTool({
    id: 21,
    name: "process_start",
    arguments: asyncArgs,
    extraParams: acceptedConsentParams({}, customAsyncConsent),
  });
  assert.equal(customAsync.result.resultType, undefined);
  assert.equal(customAsync.result.structuredContent.job_id, "job-task-1");
  assert.equal(processStartExecutions, 1);

  const missingElicitation = await callProcessTool({
    id: 3,
    name: "run_process",
    arguments: { command: "node", timeout_ms: 5000 },
    context: { ...taskContext, requestMetadata: { protocolVersion: "2026-07-28", clientCapabilities: {} } },
  });
  assert.equal(missingElicitation.error.code, -32021);
  assert.equal(syncRunExecutions, 0);

  const plainContext = {
    ...taskContext,
    requestMetadata: { protocolVersion: "2026-07-28", clientCapabilities: { elicitation: {} } },
  };
  const plainArgs = { command: "node", timeout_ms: 5000 };
  const plainConsent = await callProcessTool({ id: 30, name: "run_process", arguments: plainArgs, context: plainContext });
  assert.equal(plainConsent.result.resultType, "input_required");
  assert.equal(syncRunExecutions, 0);
  const plainRun = await callProcessTool({
    id: 31,
    name: "run_process",
    arguments: plainArgs,
    context: plainContext,
    extraParams: acceptedConsentParams({}, plainConsent),
  });
  assert.equal(plainRun.result.resultType, undefined);
  assert.equal(syncRunExecutions, 1);

  const legacyProcess = await callProcessTool({
    id: 32,
    name: "run_process",
    arguments: plainArgs,
    context: {
      ...plainContext,
      protocolVersion: "2025-06-18",
      requestMetadata: { protocolVersion: "2025-06-18", clientCapabilities: { elicitation: {} } },
    },
  });
  assert.equal(legacyProcess.error.code, -32602);
  assert.equal(legacyProcess.error.data.decision_code, "mrtr_protocol_error");
  assert.equal(syncRunExecutions, 1, "legacy high-risk process call must fail closed before execution");

  // The ad-hoc legacy trace_id cannot yet be reconstructed after restart. Until
  // P1 W3C Trace Context lands, such calls stay on the ordinary synchronous path after consent.
  const tracedArgs = { command: "node", timeout_ms: 5000, trace_id: "legacy-trace" };
  const tracedConsent = await callProcessTool({ id: 33, name: "run_process", arguments: tracedArgs });
  assert.equal(tracedConsent.result.resultType, "input_required");
  const tracedRun = await callProcessTool({
    id: 34,
    name: "run_process",
    arguments: tracedArgs,
    extraParams: acceptedConsentParams({}, tracedConsent),
  });
  assert.equal(tracedRun.result.resultType, undefined);
  assert.equal(tracedRun.result.structuredContent.trace_id, "legacy-trace");
  assert.equal(syncRunExecutions, 2);

  const working = await dispatchRpcMessage(dispatchArgs(taskContext, { id: 4, method: "tasks/get", params: { taskId: "job-task-1" } }));
  assert.equal(working.result.status, "working");
  assert.equal(working.result.result, undefined);

  manager.status = () => status({ status: "ok", terminal: true, finished_at: "2026-08-14T07:00:00.220Z", exit_code: 0 });
  const completed = await dispatchRpcMessage(dispatchArgs(taskContext, { id: 5, method: "tasks/get", params: { taskId: "job-task-1" } }));
  assert.equal(completed.result.status, "completed");
  assert.equal(completed.result.result.structuredContent.stdout, "done\n");
  assert.deepEqual(completed.result.result.structuredContent.args, []);
  assert.equal(completed.result.result._meta["mcp-tests/processArgsRedacted"], true);
  assert.equal(completed.result.result._meta["mcp-tests/taskBackedProcess"], true);

  manager.status = () => status({ status: "interrupted", terminal: true, finished_at: "2026-08-14T07:00:00.230Z", error: "execution interrupted" });
  const interrupted = await dispatchRpcMessage(dispatchArgs(taskContext, { id: 6, method: "tasks/get", params: { taskId: "job-task-1" } }));
  assert.equal(interrupted.result.status, "failed");
  assert.equal(interrupted.result.error.code, -32603);
  assert.equal(interrupted.result.result, undefined);

  manager.status = () => status();
  const cancel = await dispatchRpcMessage(dispatchArgs(taskContext, { id: 7, method: "tasks/cancel", params: { taskId: "job-task-1" } }));
  assert.deepEqual(cancel.result, {});

  const missingCapability = await dispatchRpcMessage(dispatchArgs({
    ...taskContext,
    requestMetadata: { protocolVersion: "2026-07-28", clientCapabilities: {} },
  }, { id: 8, method: "tasks/get", params: { taskId: "job-task-1" } }));
  assert.equal(missingCapability.error.code, -32021);

  const legacyProtocol = await dispatchRpcMessage(dispatchArgs({ ...taskContext, protocolVersion: "2025-06-18" }, {
    id: 9,
    method: "tasks/get",
    params: { taskId: "job-task-1" },
  }));
  assert.equal(legacyProtocol.error.code, -32601);

  const discover = await dispatchRpcMessage(dispatchArgs(taskContext, { id: 10, method: "server/discover", params: {} }));
  assert.deepEqual(discover.result.capabilities.extensions[TASKS_EXTENSION_ID], {});

  const missingTaskName = validateModernHttpHeaders({
    headers: { "mcp-method": "tasks/get" },
    message: { id: 11, method: "tasks/get", params: { taskId: "job-task-1" } },
  });
  assert.equal(missingTaskName.ok, false);
  assert.equal(missingTaskName.response.error.code, -32020);
  const validTaskName = validateModernHttpHeaders({
    headers: { "mcp-method": "tasks/get", "mcp-name": "job-task-1" },
    message: { id: 12, method: "tasks/get", params: { taskId: "job-task-1" } },
  });
  assert.equal(validTaskName.ok, true);

  const updateAck = await dispatchRpcMessage(dispatchArgs(taskContext, {
    id: 13,
    method: "tasks/update",
    params: { taskId: "job-task-1", inputResponses: {} },
  }));
  assert.deepEqual(updateAck.result, {});
  const invalidUpdate = await dispatchRpcMessage(dispatchArgs(taskContext, {
    id: 14,
    method: "tasks/update",
    params: { taskId: "job-task-1" },
  }));
  assert.equal(invalidUpdate.error.code, -32602);
  const noTaskList = await dispatchRpcMessage(dispatchArgs(taskContext, { id: 15, method: "tasks/list", params: {} }));
  assert.equal(noTaskList.error.code, -32601);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-tasks-restart-"));
  const storageFile = path.join(tempRoot, "tasks.sqlite");
  const runtimeScope = "smoke-mcp-tasks";
  const config = Object.freeze({
    ...PROCESS_RUNNER_CONFIG,
    maxConcurrent: 1,
    maxQueued: 2,
    maxRetained: 16,
    retentionMs: 60000,
  });
  let firstManager = null;
  let secondManager = null;
  try {
    firstManager = createProcessJobManager({
      config,
      storageFile,
      runtimeScope,
      serverInstanceId: "tasks-instance-one",
      idempotencySecret: "tasks-restart-idempotency-secret",
    });
    const firstContext = {
      ...taskContext,
      requestId: "req-task-restart-one",
      processJobManager: firstManager,
    };
    const actualArgs = { command: "node", args: ["--version"], cwd: "mcp-tests", timeout_ms: 5000 };
    const actualConsent = await handleToolsCall({
      id: 16,
      params: { name: "run_process", arguments: actualArgs },
      context: firstContext,
      outputMode: "structured",
      documentRuntimeContext: () => ({ docs: [] }),
      auditLog() {},
      authMode: "oauth21",
      profile: "internal",
      getOptionalTool(name) { return name === "run_process" ? runProcessTool : null; },
      rateLimiter: null,
      mrtrExtension,
    });
    assert.equal(actualConsent.result.resultType, "input_required");
    const actualTask = await handleToolsCall({
      id: 160,
      params: acceptedConsentParams({ name: "run_process", arguments: actualArgs }, actualConsent),
      context: firstContext,
      outputMode: "structured",
      documentRuntimeContext: () => ({ docs: [] }),
      auditLog() {},
      authMode: "oauth21",
      profile: "internal",
      getOptionalTool(name) { return name === "run_process" ? runProcessTool : null; },
      rateLimiter: null,
      mrtrExtension,
    });
    assert.equal(actualTask.result.resultType, "task");
    assert.match(actualTask.result.taskId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const taskId = actualTask.result.taskId;

    const immediatelyReadable = await dispatchRpcMessage(dispatchArgs(firstContext, {
      id: 17, method: "tasks/get", params: { taskId },
    }));
    assert.equal(immediatelyReadable.error, undefined, "CreateTaskResult must not precede durable task visibility");

    await waitFor(() => {
      const current = firstManager.status(taskId, { ownerId: "client-a" });
      return current.terminal ? current : null;
    });
    const completedBeforeRestart = await dispatchRpcMessage(dispatchArgs(firstContext, {
      id: 18, method: "tasks/get", params: { taskId },
    }));
    assert.equal(completedBeforeRestart.result.status, "completed");
    assert.match(completedBeforeRestart.result.result.structuredContent.stdout, /^v\d+/);
    assert.deepEqual(completedBeforeRestart.result.result.structuredContent.args, []);
    firstManager.close();
    firstManager = null;

    secondManager = createProcessJobManager({
      config,
      storageFile,
      runtimeScope,
      serverInstanceId: "tasks-instance-two",
      idempotencySecret: "tasks-restart-idempotency-secret",
    });
    const secondContext = {
      ...taskContext,
      requestId: "req-task-restart-two",
      processJobManager: secondManager,
    };
    const recoveredStatus = secondManager.status(taskId, { ownerId: "client-a" });
    assert.equal(recoveredStatus.recovered_after_restart, true);
    const recoveredTask = await dispatchRpcMessage(dispatchArgs(secondContext, {
      id: 19, method: "tasks/get", params: { taskId },
    }));
    assert.equal(recoveredTask.result.status, "completed");
    assert.match(recoveredTask.result.result.structuredContent.stdout, /^v\d+/);
    assert.equal(recoveredTask.result.result._meta["mcp-tests/processArgsRedacted"], true);

    const crossOwner = await dispatchRpcMessage(dispatchArgs({
      ...secondContext,
      authResult: { clientId: "client-b" },
    }, { id: 20, method: "tasks/get", params: { taskId } }));
    assert.equal(crossOwner.error.code, -32602);
    const unknownTask = await dispatchRpcMessage(dispatchArgs(secondContext, {
      id: 21, method: "tasks/get", params: { taskId: "00000000-0000-4000-8000-000000000000" },
    }));
    assert.equal(unknownTask.error.code, -32602);
  } finally {
    try { firstManager?.close(); } catch {}
    try { secondManager?.close(); } catch {}
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }

  console.log("smoke_mcp_tasks_process_adapter ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
