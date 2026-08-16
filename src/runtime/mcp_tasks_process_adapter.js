"use strict";

const { isModernProtocolVersion } = require("./protocol_version_policy");
const { rpcError, rpcResult } = require("./rpc_responses");
const { toolResult } = require("./tool_result");
const { normalizeProcessToolError } = require("../util/process_tool_errors");
const {
  resolveProcessJobManager,
  resolveProcessJobOwner,
} = require("../util/process_job_manager");
const { SYNC_TIMEOUT_CEILING_MS } = require("../schemas/process_tools");

const TASKS_EXTENSION = "io.modelcontextprotocol/tasks";
const TASK_OPERATION = "mcp_tasks:tools/call:run_process";
const TASK_TOOL_NAME = "run_process";
const TASK_POLL_INTERVAL_MS = 1000;
const TASK_TERMINAL_STATUSES = new Set([
  "ok",
  "nonzero_exit",
  "timeout",
  "spawn_error",
  "cancelled",
  "interrupted",
]);

function clientSupportsTasks(context = {}) {
  if (!isModernProtocolVersion(context.protocolVersion)) return false;
  const extensions = context.requestMetadata?.clientCapabilities?.extensions;
  return Boolean(
    extensions
    && typeof extensions === "object"
    && !Array.isArray(extensions)
    && extensions[TASKS_EXTENSION]
    && typeof extensions[TASKS_EXTENSION] === "object"
  );
}

function missingCapability(id) {
  return rpcError(id, -32003, "Missing required client capability", {
    requiredCapabilities: {
      extensions: { [TASKS_EXTENSION]: {} },
    },
  });
}

function invalidTask(id, message = "Task not found") {
  return rpcError(id, -32602, `Failed to retrieve task: ${message}`);
}

function taskStatus(record) {
  if (record.status === "cancelled") return "cancelled";
  if (TASK_TERMINAL_STATUSES.has(record.status)) return "completed";
  return "working";
}

function taskBase(record, retentionMs) {
  const updatedAtMs = Number(record.updatedAtMs || record.finishedAtMs || record.startedAtMs || record.createdAtMs);
  return {
    taskId: record.id,
    status: taskStatus(record),
    createdAt: new Date(record.createdAtMs).toISOString(),
    lastUpdatedAt: new Date(updatedAtMs).toISOString(),
    ttlMs: Number.isFinite(retentionMs) ? retentionMs : null,
    pollIntervalMs: TASK_POLL_INTERVAL_MS,
  };
}

function processTaskPayload(record) {
  const finishedOrNow = record.finishedAtMs || Date.now();
  return {
    job_id: record.id,
    status: record.status,
    command: record.command,
    family: record.family,
    resolution_class: record.resolutionClass,
    cwd: record.cwd,
    workspace: record.workspace,
    exit_code: record.exitCode,
    signal: record.signal,
    timed_out: record.timedOut,
    duration_ms: record.startedAtMs === null
      ? 0
      : Math.max(0, finishedOrNow - record.startedAtMs),
    stdout: record.stdout,
    stderr: record.stderr,
    stdout_truncated: record.stdoutTruncated,
    stderr_truncated: record.stderrTruncated,
    output_limit_chars: record.outputLimit,
    error: record.error,
    durable: true,
    recovered_after_restart: record.recoveredAfterRestart,
  };
}

function createMcpTasksProcessAdapter({
  getManager = (context) => resolveProcessJobManager(context),
  outputMode = "structured",
  auditLog = () => {},
  enabled = true,
} = {}) {
  function managerFor(context) {
    return getManager(context);
  }

  function ownerFor(context) {
    return { ownerId: resolveProcessJobOwner(context) };
  }

  function retentionMs(manager) {
    return Number(manager.snapshot().retention_ms);
  }

  async function tryAugmentToolCall({ id, name, args = {}, context = {} } = {}) {
    if (!enabled) return null;
    if (name !== TASK_TOOL_NAME) return null;
    if (!clientSupportsTasks(context)) {
      return Number(args.timeout_ms || 60000) > SYNC_TIMEOUT_CEILING_MS
        ? missingCapability(id)
        : null;
    }

    const manager = managerFor(context);
    let status;
    try {
      status = manager.start(args, ownerFor(context), {
        operation: TASK_OPERATION,
        taskKind: "tools/call",
        taskToolName: TASK_TOOL_NAME,
      });
    } catch (error) {
      const result = toolResult(outputMode, normalizeProcessToolError(error));
      result.isError = true;
      return rpcResult(id, result);
    }

    const record = manager.taskRecord(status.job_id, ownerFor(context));
    auditLog("mcp_task_created", {
      request_id: context.requestId,
      task_id: record.id,
      tool: TASK_TOOL_NAME,
      status: record.status,
    });
    return rpcResult(id, {
      resultType: "task",
      ...taskBase(record, retentionMs(manager)),
    });
  }

  async function handleTaskRequest({ id, method, params = {}, context = {} } = {}) {
    if (!enabled) return null;
    if (!clientSupportsTasks(context)) return missingCapability(id);
    const taskId = typeof params.taskId === "string" ? params.taskId.trim() : "";
    if (!taskId) return invalidTask(id, "Invalid taskId");
    const manager = managerFor(context);
    const owner = ownerFor(context);
    let record;
    try {
      record = manager.taskRecord(taskId, owner);
    } catch {
      return invalidTask(id);
    }

    if (method === "tasks/get") {
      const detailed = {
        resultType: "complete",
        ...taskBase(record, retentionMs(manager)),
      };
      if (detailed.status === "completed") {
        const result = toolResult(outputMode, processTaskPayload(record));
        if (record.status !== "ok") result.isError = true;
        detailed.result = result;
      }
      auditLog("mcp_task_read", {
        request_id: context.requestId,
        task_id: record.id,
        status: record.status,
      });
      return rpcResult(id, detailed);
    }

    if (method === "tasks/update") {
      if (!params.inputResponses || typeof params.inputResponses !== "object" || Array.isArray(params.inputResponses)) {
        return rpcError(id, -32602, "Invalid params", { reason: "input_responses_required" });
      }
      auditLog("mcp_task_updated", {
        request_id: context.requestId,
        task_id: record.id,
        ignored_response_count: Object.keys(params.inputResponses).length,
      });
      return rpcResult(id, { resultType: "complete" });
    }

    if (method === "tasks/cancel") {
      await manager.cancel(taskId, "mcp_task_cancel", owner);
      auditLog("mcp_task_cancel_requested", {
        request_id: context.requestId,
        task_id: record.id,
      });
      return rpcResult(id, { resultType: "complete" });
    }

    return null;
  }

  return {
    enabled: enabled === true,
    handleTaskRequest,
    serverCapability: () => enabled === true ? { [TASKS_EXTENSION]: {} } : {},
    tryAugmentToolCall,
  };
}

module.exports = {
  TASKS_EXTENSION,
  TASK_OPERATION,
  clientSupportsTasks,
  createMcpTasksProcessAdapter,
};
