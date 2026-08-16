"use strict";

const { rpcError, rpcResult } = require("./rpc_responses");
const { toolResult } = require("./tool_result");
const { isModernProtocolVersion } = require("./protocol_version_policy");
const { resolveProcessJobManager } = require("../util/process_job_manager");
const { resolveProcessJobOwner } = require("../util/process_job_owner");
const { createChildTraceContext, traceAuditFields } = require("./trace_context");
const { buildProcessArtifactResourceLink } = require("./process_artifact_resource");

const TASKS_EXTENSION_ID = "io.modelcontextprotocol/tasks";
const TASKABLE_PROCESS_TOOL = "run_process";
const TASK_POLL_INTERVAL_MS = 1000;
const TASK_TTL_MS = 0;
const TASK_OUTPUT_READ_CHARS = 65536;
const TASK_INLINE_OUTPUT_CHARS = 32768;
const MISSING_REQUIRED_CLIENT_CAPABILITY = -32003;
const PROCESS_ARGS_REDACTED_META_KEY = "mcp-tests/processArgsRedacted";
const PROCESS_TASK_BACKED_META_KEY = "mcp-tests/taskBackedProcess";

function clientSupportsTasks(context = {}) {
  const extensions = context.requestMetadata?.clientCapabilities?.extensions;
  return Boolean(
    extensions
      && typeof extensions === "object"
      && !Array.isArray(extensions)
      && Object.prototype.hasOwnProperty.call(extensions, TASKS_EXTENSION_ID)
  );
}

function latestProcessTimestamp(status = {}) {
  return status.finished_at || status.started_at || status.created_at || new Date(0).toISOString();
}

function processTaskStatus(status = {}) {
  if (status.status === "cancelled") return "cancelled";
  if (status.status === "interrupted") return "failed";
  if (status.terminal === true) return "completed";
  return "working";
}

function buildTaskMetadata(status = {}) {
  return {
    taskId: String(status.job_id || ""),
    status: processTaskStatus(status),
    createdAt: String(status.created_at || latestProcessTimestamp(status)),
    lastUpdatedAt: String(latestProcessTimestamp(status)),
    // The shared process registry has bounded time/capacity retention. Until the
    // registry can reserve a minimum task-specific retention window, do not
    // promise one to clients.
    ttlMs: TASK_TTL_MS,
    pollIntervalMs: TASK_POLL_INTERVAL_MS,
  };
}

function readDurableRunResult(manager, taskId, ownerId, status = {}) {
  const hardLimit = Math.max(1, Number(status.output_limit_chars || 1000000));
  const chunk = manager.output(taskId, {
    stdout_offset: 0,
    stderr_offset: 0,
    max_chars: TASK_INLINE_OUTPUT_CHARS,
  }, { ownerId });
  const persistedTrace = typeof manager.trace === "function" ? manager.trace(taskId, { ownerId }) : null;
  return {
    status: status.status,
    command: status.command,
    args: [],
    cwd: status.cwd,
    workspace: status.workspace,
    exit_code: status.exit_code,
    signal: status.signal,
    timed_out: status.timed_out === true,
    duration_ms: Number(status.duration_ms || 0),
    stdout: String(chunk.stdout || ""),
    stderr: String(chunk.stderr || ""),
    stdout_truncated: status.stdout_truncated === true || chunk.stdout_eof !== true,
    stderr_truncated: status.stderr_truncated === true || chunk.stderr_eof !== true,
    output_limit_chars: Number(status.output_limit_chars || hardLimit),
    trace_id: persistedTrace?.trace_id || null,
    error: status.error ?? null,
  };
}

function interruptedTaskError(status = {}) {
  return {
    code: -32603,
    message: "Process task was interrupted before completion.",
    data: {
      reason: "process_execution_interrupted",
      job_id: String(status.job_id || ""),
    },
  };
}

function buildDetailedTask({ manager, ownerId, status, outputMode = "structured" }) {
  const task = buildTaskMetadata(status);
  if (task.status === "completed") {
    const result = toolResult(
      outputMode,
      readDurableRunResult(manager, task.taskId, ownerId, status)
    );
    const outputChars = Number(status.stdout_chars || 0) + Number(status.stderr_chars || 0);
    const needsArtifacts = outputChars > TASK_INLINE_OUTPUT_CHARS
      || status.stdout_truncated === true
      || status.stderr_truncated === true;
    result._meta = {
      ...(result._meta || {}),
      [PROCESS_ARGS_REDACTED_META_KEY]: true,
      [PROCESS_TASK_BACKED_META_KEY]: true,
      ...(needsArtifacts ? { "mcp-tests/processArtifactOutputExcerpt": true } : {}),
    };
    if (needsArtifacts && typeof manager.artifacts === "function") {
      const artifacts = manager.artifacts(task.taskId, { ownerId });
      const links = Array.isArray(artifacts)
        ? artifacts.map(buildProcessArtifactResourceLink)
        : [];
      result.content.push(...links);
      result._meta["mcp-tests/processArtifactCount"] = links.length;
    }
    task.result = result;
  } else if (task.status === "failed") {
    task.statusMessage = status.error
      ? `Process task interrupted: ${String(status.error).slice(0, 300)}`
      : "Process task interrupted before completion.";
    task.error = interruptedTaskError(status);
  }
  return task;
}

function missingCapability(id) {
  return rpcError(id, MISSING_REQUIRED_CLIENT_CAPABILITY, "Missing required client capability", {
    requiredCapabilities: {
      extensions: {
        [TASKS_EXTENSION_ID]: {},
      },
    },
  });
}

function invalidTaskParams(id, reason) {
  return rpcError(id, -32602, "Invalid params", { reason });
}

function normalizeTaskId(params = {}) {
  return typeof params.taskId === "string" ? params.taskId.trim() : "";
}

function taskAccessError(id, error) {
  if (error?.code === "process_job_not_found") return invalidTaskParams(id, "task_not_found");
  if (error?.code === "process_job_owner_required") return invalidTaskParams(id, "task_owner_required");
  throw error;
}

function taskCreationError(id, error) {
  return rpcError(id, -32603, "Failed to create process task", {
    reason: typeof error?.code === "string" ? error.code : "process_task_creation_failed",
  });
}

function shouldTaskAugmentTool(name, context = {}, args = {}) {
  // Legacy callers may still send `trace_id`. When a canonical W3C request
  // context exists it is authoritative for the task-backed execution; without
  // W3C context the legacy field keeps the synchronous compatibility path.
  const hasLegacyTraceId = args.trace_id !== undefined && args.trace_id !== null;
  const legacyTraceWithoutW3cContext = hasLegacyTraceId && !context.traceContext;
  return name === TASKABLE_PROCESS_TOOL
    && !legacyTraceWithoutW3cContext
    && isModernProtocolVersion(context.protocolVersion)
    && clientSupportsTasks(context);
}

function tryStartTaskAugmentedToolCall({
  id,
  name,
  args = {},
  context = {},
  startedAt = Date.now(),
  auditLog = () => {},
} = {}) {
  if (!shouldTaskAugmentTool(name, context, args)) return null;

  try {
    const ownerId = resolveProcessJobOwner(context);
    const manager = resolveProcessJobManager(context);
    const executionTrace = context.traceContext ? createChildTraceContext(context.traceContext) : null;
    const status = manager.start(args, { ownerId }, { traceContext: executionTrace });
    const task = buildTaskMetadata(status);

    auditLog("tool_call_end", {
      request_id: context.requestId,
      tool: name,
      duration_ms: Date.now() - startedAt,
      is_error: false,
      error_code: null,
      result_count: 1,
      result_chars: 0,
      task_id: task.taskId,
      task_status: task.status,
      task_extension: TASKS_EXTENSION_ID,
      ...traceAuditFields(context.traceContext),
      execution_trace_id: executionTrace?.traceId || null,
      execution_span_id: executionTrace?.spanId || null,
    });

    return rpcResult(id, {
      resultType: "task",
      ...task,
    });
  } catch (error) {
    auditLog("tool_call_error", {
      request_id: context.requestId,
      tool: name,
      duration_ms: Date.now() - startedAt,
      error_kind: typeof error?.code === "string" ? error.code : "process_task_creation_failed",
      ...traceAuditFields(context.traceContext),
    });
    return taskCreationError(id, error);
  }
}

async function handleTaskProtocolMethod({ id, method, params = {}, context = {}, outputMode = "structured" } = {}) {
  if (!isModernProtocolVersion(context.protocolVersion)) return null;
  if (!clientSupportsTasks(context)) return missingCapability(id);

  const taskId = normalizeTaskId(params);
  if (!taskId) return invalidTaskParams(id, "task_id_required");

  let ownerId;
  let manager;
  try {
    ownerId = resolveProcessJobOwner(context);
    manager = resolveProcessJobManager(context);
  } catch (error) {
    return taskAccessError(id, error);
  }

  try {
    if (method === "tasks/get") {
      const status = manager.status(taskId, { ownerId });
      return rpcResult(id, {
        resultType: "complete",
        ...buildDetailedTask({ manager, ownerId, status, outputMode }),
      });
    }

    if (method === "tasks/update") {
      const inputResponses = params.inputResponses;
      if (!inputResponses || typeof inputResponses !== "object" || Array.isArray(inputResponses)) {
        return invalidTaskParams(id, "input_responses_required");
      }
      // Process-backed tasks never enter input_required. Reading the task here
      // validates existence and owner isolation; unknown/already-satisfied input
      // keys are intentionally ignored as required by the Tasks extension.
      manager.status(taskId, { ownerId });
      return rpcResult(id, {});
    }

    if (method === "tasks/cancel") {
      await manager.cancel(taskId, "mcp_tasks_cancel", { ownerId });
      return rpcResult(id, {});
    }
  } catch (error) {
    return taskAccessError(id, error);
  }

  return null;
}

module.exports = {
  MISSING_REQUIRED_CLIENT_CAPABILITY,
  PROCESS_ARGS_REDACTED_META_KEY,
  PROCESS_TASK_BACKED_META_KEY,
  TASKABLE_PROCESS_TOOL,
  TASKS_EXTENSION_ID,
  TASK_INLINE_OUTPUT_CHARS,
  TASK_OUTPUT_READ_CHARS,
  TASK_POLL_INTERVAL_MS,
  TASK_TTL_MS,
  buildDetailedTask,
  buildTaskMetadata,
  clientSupportsTasks,
  handleTaskProtocolMethod,
  processTaskStatus,
  readDurableRunResult,
  shouldTaskAugmentTool,
  tryStartTaskAugmentedToolCall,
};
