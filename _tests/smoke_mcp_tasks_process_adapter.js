"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createMcpTasksProcessAdapter } = require("../src/runtime/mcp_tasks_process_adapter");
const { handleServerDiscoverMessage } = require("../src/runtime/server_discover_message_handler");
const { dispatchRpcMessage } = require("../src/runtime/rpc_message_dispatcher");
const { createMcpRuntimeHandlers } = require("../src/runtime/mcp_runtime_handlers");
const { validateModernHttpHeaders } = require("../src/runtime/request_metadata_policy");
const { runProcessTool } = require("../tools/run_process");
const { createProcessJobManager } = require("../src/util/process_job_manager");
const { PROCESS_RUNNER_CONFIG } = require("../src/util/process_runner_config");

const TASKS_EXTENSION = "io.modelcontextprotocol/tasks";

function context(clientId, supportsTasks = true) {
  return {
    protocolVersion: "2026-07-28",
    authResult: { clientId },
    requestMetadata: {
      clientCapabilities: supportsTasks
        ? { extensions: { [TASKS_EXTENSION]: {} } }
        : {},
    },
  };
}

async function waitFor(predicate, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await predicate();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

(async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tasks-process-"));
  const storageFile = path.join(tempRoot, "jobs.sqlite");
  const config = Object.freeze({
    ...PROCESS_RUNNER_CONFIG,
    maxConcurrent: 1,
    maxQueued: 4,
    retentionMs: 60000,
  });
  let manager = createProcessJobManager({
    config,
    storageFile,
    runtimeScope: "mcp-task-smoke",
    serverInstanceId: "task-instance-one",
    idempotencySecret: "task-smoke-secret",
  });

  try {
    let adapter = createMcpTasksProcessAdapter({
      getManager: () => manager,
      outputMode: "structured",
    });
    assert.equal(adapter.enabled, true);
    assert.deepEqual(adapter.serverCapability(), { [TASKS_EXTENSION]: {} });

    const discover = handleServerDiscoverMessage({
      id: 100,
      protocolVersion: "2026-07-28",
      requestMetadata: context("client-a").requestMetadata,
      serverName: "mcp-task-smoke",
      serverVersion: "1",
      connectorShapeVersion: "test",
      outputMode: "structured",
      authMode: "oauth21",
      profile: "internal",
      tools: [],
      mcpTasksAdapter: adapter,
    });
    assert.deepEqual(discover.result.capabilities.extensions, { [TASKS_EXTENSION]: {} });

    const taskHeaderMessage = {
      id: 101,
      method: "tasks/get",
      params: { taskId: "task-header-id" },
    };
    assert.equal(validateModernHttpHeaders({
      headers: { "mcp-method": "tasks/get" },
      message: taskHeaderMessage,
    }).reason, "name_header_required");
    assert.equal(validateModernHttpHeaders({
      headers: { "mcp-method": "tasks/get", "mcp-name": "wrong" },
      message: taskHeaderMessage,
    }).reason, "name_header_mismatch");
    assert.equal(validateModernHttpHeaders({
      headers: { "mcp-method": "tasks/get", "mcp-name": "task-header-id" },
      message: taskHeaderMessage,
    }).ok, true);

    const unsupportedShort = await adapter.tryAugmentToolCall({
      id: 1,
      name: "run_process",
      args: { command: "node", args: ["--version"], cwd: "mcp-tests" },
      context: context("client-a", false),
    });
    assert.equal(unsupportedShort, null, "short calls remain synchronous without Tasks");

    const unsupportedLong = await adapter.tryAugmentToolCall({
      id: 2,
      name: "run_process",
      args: { command: "node", args: ["--version"], cwd: "mcp-tests", timeout_ms: 90001 },
      context: context("client-a", false),
    });
    assert.equal(unsupportedLong.error.code, -32003);

    const created = await adapter.tryAugmentToolCall({
      id: 3,
      name: "run_process",
      args: {
        command: "node",
        args: ["-e", "process.stdout.write('TASK_RESULT_OK')"],
        cwd: "mcp-tests",
        idempotency_key: "task-retry-key",
      },
      context: context("client-a"),
    });
    assert.equal(created.result.resultType, "task");
    assert.match(created.result.taskId, /^[0-9a-f-]{36}$/i);
    assert.equal(["working", "completed"].includes(created.result.status), true);

    const handlers = createMcpRuntimeHandlers({
      serverName: "mcp-task-smoke",
      serverVersion: "1",
      connectorShapeVersion: "test",
      outputMode: "structured",
      authPolicy: { mode: "oauth21" },
      runtimeProfile: "internal",
      toolsList: () => [runProcessTool.descriptor],
      toolIntrospection: () => ({
        tools: [runProcessTool.descriptor],
        toolNames: ["run_process"],
      }),
      documentRuntimeContext: () => ({ docs: [] }),
      auditLog() {},
      getOptionalTool: (name) => name === "run_process" ? runProcessTool : null,
      rateLimiter: null,
      serverStartId: "task-runtime-start",
      mcpTasksAdapter: adapter,
    });
    const routedCreate = await handlers.handleRpcMessage({
      jsonrpc: "2.0",
      id: 301,
      method: "tools/call",
      params: {
        name: "run_process",
        arguments: {
          command: "node",
          args: ["-e", "process.stdout.write('ROUTED_TASK_OK')"],
          cwd: "mcp-tests",
        },
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientCapabilities": {
            extensions: { [TASKS_EXTENSION]: {} },
          },
        },
      },
    }, {
      ...context("client-a"),
      protocolVersionHeader: "2026-07-28",
      requestHeaders: {
        "mcp-method": "tools/call",
        "mcp-name": "run_process",
      },
      requestId: "task-routed-create",
      processJobManager: manager,
    });
    assert.equal(routedCreate.result.resultType, "task");
    assert.equal(routedCreate.result._meta["io.modelcontextprotocol/serverInfo"].name, "mcp-task-smoke");
    await waitFor(() => manager.status(routedCreate.result.taskId, { ownerId: "client-a" }).terminal);

    const retried = await adapter.tryAugmentToolCall({
      id: 4,
      name: "run_process",
      args: {
        command: "node",
        args: ["-e", "process.stdout.write('TASK_RESULT_OK')"],
        cwd: "mcp-tests",
        idempotency_key: "task-retry-key",
      },
      context: context("client-a"),
    });
    assert.equal(retried.result.taskId, created.result.taskId);

    const taskId = created.result.taskId;
    const completed = await waitFor(async () => {
      const response = await adapter.handleTaskRequest({
        id: 5,
        method: "tasks/get",
        params: { taskId },
        context: context("client-a"),
      });
      return response.result.status === "completed" ? response : null;
    });
    assert.equal(completed.result.resultType, "complete");
    assert.equal(completed.result.result.structuredContent.stdout, "TASK_RESULT_OK");
    assert.equal(completed.result.result.structuredContent.job_id, taskId);
    assert.equal("args" in completed.result.result.structuredContent, false);
    assert.equal("env" in completed.result.result.structuredContent, false);

    const crossOwner = await adapter.handleTaskRequest({
      id: 6,
      method: "tasks/get",
      params: { taskId },
      context: context("client-b"),
    });
    assert.equal(crossOwner.error.code, -32602);

    const missingCapability = await adapter.handleTaskRequest({
      id: 7,
      method: "tasks/get",
      params: { taskId },
      context: context("client-a", false),
    });
    assert.equal(missingCapability.error.code, -32003);

    const update = await adapter.handleTaskRequest({
      id: 8,
      method: "tasks/update",
      params: { taskId, inputResponses: { unknown: { action: "accept" } } },
      context: context("client-a"),
    });
    assert.deepEqual(update.result, { resultType: "complete" });

    manager.close();
    manager = createProcessJobManager({
      config,
      storageFile,
      runtimeScope: "mcp-task-smoke",
      serverInstanceId: "task-instance-two",
      idempotencySecret: "task-smoke-secret",
    });
    adapter = createMcpTasksProcessAdapter({
      getManager: () => manager,
      outputMode: "structured",
    });
    const afterRestart = await adapter.handleTaskRequest({
      id: 9,
      method: "tasks/get",
      params: { taskId },
      context: context("client-a"),
    });
    assert.equal(afterRestart.result.status, "completed");
    assert.equal(afterRestart.result.result.structuredContent.stdout, "TASK_RESULT_OK");

    const routedAfterRestart = await dispatchRpcMessage({
      prelude: { id: 91, method: "tasks/get", params: { taskId } },
      context: context("client-a"),
      serverName: "mcp-task-smoke",
      serverVersion: "1",
      connectorShapeVersion: "test",
      outputMode: "structured",
      authMode: "oauth21",
      profile: "internal",
      tools: [],
      auditLog() {},
      getOptionalTool() { return null; },
      mcpTasksAdapter: adapter,
    });
    assert.equal(routedAfterRestart.result.status, "completed");

    const cancellable = await adapter.tryAugmentToolCall({
      id: 10,
      name: "run_process",
      args: {
        command: "node",
        args: ["-e", "setTimeout(() => process.stdout.write('late'), 5000)"],
        cwd: "mcp-tests",
      },
      context: context("client-a"),
    });
    const cancel = await adapter.handleTaskRequest({
      id: 11,
      method: "tasks/cancel",
      params: { taskId: cancellable.result.taskId },
      context: context("client-a"),
    });
    assert.deepEqual(cancel.result, { resultType: "complete" });
    const cancelled = await adapter.handleTaskRequest({
      id: 12,
      method: "tasks/get",
      params: { taskId: cancellable.result.taskId },
      context: context("client-a"),
    });
    assert.equal(["cancelled", "completed"].includes(cancelled.result.status), true);

    const ordinaryJob = manager.start({
      command: "node",
      args: ["--version"],
      cwd: "mcp-tests",
    }, { ownerId: "client-a" });
    const notATask = await adapter.handleTaskRequest({
      id: 13,
      method: "tasks/get",
      params: { taskId: ordinaryJob.job_id },
      context: context("client-a"),
    });
    assert.equal(notATask.error.code, -32602, "ordinary process jobs are not MCP Tasks");
    await waitFor(() => manager.status(ordinaryJob.job_id, { ownerId: "client-a" }).terminal);

    console.log("smoke_mcp_tasks_process_adapter ok");
  } finally {
    try { manager.close(); } catch {}
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
