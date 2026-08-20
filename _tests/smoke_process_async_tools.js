"use strict";

const assert = require("node:assert/strict");

const { processStartTool } = require("../tools/process_start");
const { processStatusTool } = require("../tools/process_status");
const { processOutputTool } = require("../tools/process_output");
const { processCancelTool } = require("../tools/process_cancel");
const { processListTool } = require("../tools/process_list");
const { processEventsTool } = require("../tools/process_events");
const { loadOptionalTools } = require("../src/tool_loader");
const { getToolPolicy } = require("../src/tool_policy");
const { createProcessJobManager } = require("../src/util/process_job_manager");
const { PROCESS_RUNNER_CONFIG } = require("../src/util/process_runner_config");
const { buildDecisionRuntimeContext } = require("../src/runtime/decision_runtime_context_builder");
const { evaluateDecisionRuntimePolicy } = require("../src/runtime/decision_runtime_policy");
const { tryHandleOptionalToolCall } = require("../src/runtime/optional_tool_call_handler");
const { safeWorkspacePath } = require("../src/util/workspace_roots");

async function waitFor(predicate, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

(async () => {
  const manager = createProcessJobManager({
    config: Object.freeze({ ...PROCESS_RUNNER_CONFIG, maxConcurrent: 1 }),
  });
  const context = {
    processJobManager: manager,
    authResult: { clientId: "client-a" },
  };
  const otherClientContext = {
    processJobManager: manager,
    authResult: { clientId: "client-b" },
  };
  const tools = [processStartTool, processStatusTool, processOutputTool, processCancelTool, processListTool, processEventsTool];
  assert.deepEqual(tools.map((tool) => tool.name), [
    "process_start",
    "process_status",
    "process_output",
    "process_cancel",
    "process_list",
    "process_events",
  ]);

  assert.equal(processStartTool.descriptor.annotations.readOnlyHint, false);
  assert.equal(processStartTool.descriptor.annotations.destructiveHint, true);
  assert.equal(processStartTool.descriptor.annotations.openWorldHint, true);
  assert.equal(processStartTool.descriptor.inputSchema.properties.idempotency_key.maxLength, 200);
  assert.equal(processCancelTool.descriptor.annotations.destructiveHint, true);
  assert.equal(processCancelTool.descriptor.annotations.openWorldHint, true);
  assert.equal(processStatusTool.descriptor.annotations.readOnlyHint, true);
  assert.equal(processOutputTool.descriptor.annotations.readOnlyHint, true);
  assert.equal(processListTool.descriptor.annotations.readOnlyHint, true);
  assert.equal(processEventsTool.descriptor.annotations.readOnlyHint, true);

  assert.equal(getToolPolicy("process_start").destructive, true);
  assert.equal(getToolPolicy("process_start").open_world, true);
  assert.equal(getToolPolicy("process_start").uses_fs, true);
  assert.equal(getToolPolicy("process_cancel").destructive, true);
  assert.equal(getToolPolicy("process_status").read_only, true);
  assert.equal(getToolPolicy("process_output").read_only, true);
  assert.equal(getToolPolicy("process_list").read_only, true);
  assert.equal(getToolPolicy("process_events").read_only, true);

  const loaded = loadOptionalTools({
    profile: "internal",
    authMode: "oauth21",
    authPolicy: { mode: "oauth21", requiresAuth: true },
  });
  const loadedNames = new Set(loaded.map((tool) => tool.name));
  for (const tool of tools) assert.equal(loadedNames.has(tool.name), true, `missing ${tool.name}`);
  const loadedByName = new Map(loaded.map((tool) => [tool.name, tool]));
  for (const toolName of ["run_process", "process_start", "process_cancel"]) {
    const decisionContext = buildDecisionRuntimeContext({
      toolName,
      args: toolName === "process_cancel" ? { job_id: "job-probe" } : { command: "node" },
      authMode: "oauth21",
      profile: "internal",
      getOptionalTool: (name) => loadedByName.get(name) || null,
      authResult: { subject: "operator", clientId: "client-a", scopes: ["mcp:tools"] },
    });
    const decision = evaluateDecisionRuntimePolicy({ decisionContext });
    assert.equal(decision.allow, true, `${toolName} must be callable after its dedicated runner guards pass`);
    assert.deepEqual(decision.decision_meta.reason_codes, ["explicit_policy_allow"]);
    assert.equal(decision.mrtr_requirement, undefined);
    assert.equal(getToolPolicy(toolName).consent_mode, "none");
  }
  const publicLoadedNames = new Set(loadOptionalTools({
    profile: "public",
    authMode: "none",
    serverProfileConfig: {
      surface: { optional_tool_groups: ["public"], include_memory_tools: false },
    },
  }).map((tool) => tool.name));
  for (const tool of tools) assert.equal(publicLoadedNames.has(tool.name), false, `public leak: ${tool.name}`);

  let runtimeAuditCallback = null;
  const runtimeAuditEvents = [];
  await tryHandleOptionalToolCall({
    id: 1,
    name: "process_status",
    args: { job_id: "probe" },
    context: { requestId: "process-audit-context" },
    startedAt: Date.now(),
    outputMode: "structured",
    getOptionalTool: () => ({
      execute(_args, runtimeContext) {
        runtimeAuditCallback = runtimeContext.auditLog;
        return { ok: true };
      },
    }),
    auditLog(event, payload) { runtimeAuditEvents.push({ event, payload }); },
  });
  assert.equal(typeof runtimeAuditCallback, "function");
  assert.equal(runtimeAuditEvents.at(-1).event, "tool_call_end");
  assert.equal(runtimeAuditEvents.at(-1).payload.is_error, false);
  assert.equal(runtimeAuditEvents.at(-1).payload.error_code, null);

  const rejectedAuditEvents = [];
  await tryHandleOptionalToolCall({
    id: 2,
    name: "process_start",
    args: { command: "node" },
    context: { requestId: "process-rejected-audit-context" },
    startedAt: Date.now(),
    outputMode: "structured",
    getOptionalTool: () => ({
      execute() {
        return {
          success: false,
          error: {
            code: "process_cwd_not_allowed",
            message: "Working directory is outside the configured workspace roots.",
            retryable: false,
          },
        };
      },
    }),
    auditLog(event, payload) { rejectedAuditEvents.push({ event, payload }); },
  });
  assert.equal(rejectedAuditEvents.at(-1).event, "tool_call_end");
  assert.equal(rejectedAuditEvents.at(-1).payload.is_error, true);
  assert.equal(rejectedAuditEvents.at(-1).payload.error_code, "process_cwd_not_allowed");

  const idempotentInput = {
    command: "node",
    args: ["-e", "setTimeout(() => {}, 5000)"],
    cwd: "mcp-tests",
    idempotency_key: "tool-retry-key",
  };
  const idempotentFirst = await processStartTool.execute(idempotentInput, context);
  const idempotentRetry = await processStartTool.execute({
    ...idempotentInput,
    trace_id: "new-retry-trace",
  }, context);
  assert.equal(idempotentRetry.job_id, idempotentFirst.job_id);
  const idempotentConflict = await processStartTool.execute({
    ...idempotentInput,
    args: ["-e", "process.stdout.write('different')"],
  }, context);
  assert.deepEqual(idempotentConflict, {
    success: false,
    error: {
      code: "process_idempotency_conflict",
      message: "Idempotency key was already used with different process arguments.",
      retryable: false,
    },
  });
  const otherOwnerIdempotent = await processStartTool.execute(idempotentInput, otherClientContext);
  assert.notEqual(otherOwnerIdempotent.job_id, idempotentFirst.job_id);
  await processCancelTool.execute({ job_id: otherOwnerIdempotent.job_id }, otherClientContext);
  await processCancelTool.execute({ job_id: idempotentFirst.job_id }, context);

  const started = await processStartTool.execute({
    command: "node",
    args: ["-e", "process.stdout.write('async-tool-output')"],
    cwd: safeWorkspacePath("mcp-tests").absolutePath,
  }, context);
  assert.equal(started.command, "node");
  assert.equal(started.terminal, false);

  const completed = await waitFor(async () => {
    const status = await processStatusTool.execute({ job_id: started.job_id }, context);
    return status.terminal ? status : null;
  });
  assert.equal(completed.status, "ok");
  assert.equal(completed.cwd, "mcp-tests");
  const hiddenStatus = await processStatusTool.execute({ job_id: started.job_id }, otherClientContext);
  assert.deepEqual(hiddenStatus, {
    success: false,
    error: {
      code: "process_job_not_found",
      message: "Process job was not found or is not owned by this client.",
      retryable: false,
    },
  });

  const output = await processOutputTool.execute({
    job_id: started.job_id,
    stdout_offset: 0,
    stderr_offset: 0,
    max_chars: 65536,
  }, context);
  assert.equal(output.stdout, "async-tool-output");
  assert.equal(output.stdout_eof, true);

  const listed = await processListTool.execute({ limit: 10 }, context);
  assert.equal(listed.durable, true);
  assert.equal(listed.jobs.some((job) => job.job_id === started.job_id), true);
  const events = await processEventsTool.execute({ job_id: started.job_id, limit: 50 }, context);
  assert.equal(events.durable, true);
  assert.equal(events.events.some((event) => event.to_status === "ok"), true);
  const hiddenEvents = await processEventsTool.execute({ job_id: started.job_id }, otherClientContext);
  assert.equal(hiddenEvents.success, false);
  assert.equal(hiddenEvents.error.code, "process_job_not_found");

  for (const [tool, args] of [
    [processStatusTool, { job_id: "missing-job" }],
    [processOutputTool, { job_id: "missing-job" }],
    [processCancelTool, { job_id: "missing-job" }],
  ]) {
    const missing = await tool.execute(args, context);
    assert.equal(missing.success, false);
    assert.equal(missing.error.code, "process_job_not_found");
  }
  const deniedCommand = await processStartTool.execute({ command: "cmd", cwd: "mcp-tests" }, context);
  assert.equal(deniedCommand.success, false);
  assert.equal(deniedCommand.error.code, "process_command_not_allowed");
  const deniedEnv = await processStartTool.execute({
    command: "node",
    cwd: "mcp-tests",
    env: { PYTHONPATH: "C:\\untrusted" },
  }, context);
  assert.equal(deniedEnv.success, false);
  assert.equal(deniedEnv.error.code, "process_env_not_allowed");

  const longJob = await processStartTool.execute({
    command: "node",
    args: ["-e", "setTimeout(() => {}, 5000)"],
    cwd: "mcp-tests",
  }, context);
  const cancelled = await processCancelTool.execute({
    job_id: longJob.job_id,
    reason: "tool_test",
  }, context);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.terminal, true);

  await manager.shutdown("test_shutdown");
  manager.close();
  console.log("smoke_process_async_tools ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
