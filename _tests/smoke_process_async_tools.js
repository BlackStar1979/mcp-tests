"use strict";

const assert = require("node:assert/strict");

const { processStartTool } = require("../tools/process_start");
const { processStatusTool } = require("../tools/process_status");
const { processOutputTool } = require("../tools/process_output");
const { processCancelTool } = require("../tools/process_cancel");
const { loadOptionalTools } = require("../src/tool_loader");
const { getToolPolicy } = require("../src/tool_policy");
const { createProcessJobManager } = require("../src/util/process_job_manager");
const { PROCESS_RUNNER_CONFIG } = require("../src/util/process_runner_config");
const { buildDecisionRuntimeContext } = require("../src/runtime/decision_runtime_context_builder");
const { evaluateDecisionRuntimePolicy } = require("../src/runtime/decision_runtime_policy");
const { tryHandleOptionalToolCall } = require("../src/runtime/optional_tool_call_handler");

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
  const tools = [processStartTool, processStatusTool, processOutputTool, processCancelTool];
  assert.deepEqual(tools.map((tool) => tool.name), [
    "process_start",
    "process_status",
    "process_output",
    "process_cancel",
  ]);

  assert.equal(processStartTool.descriptor.annotations.readOnlyHint, false);
  assert.equal(processStartTool.descriptor.annotations.destructiveHint, true);
  assert.equal(processStartTool.descriptor.annotations.openWorldHint, true);
  assert.equal(processCancelTool.descriptor.annotations.destructiveHint, true);
  assert.equal(processCancelTool.descriptor.annotations.openWorldHint, true);
  assert.equal(processStatusTool.descriptor.annotations.readOnlyHint, true);
  assert.equal(processOutputTool.descriptor.annotations.readOnlyHint, true);

  assert.equal(getToolPolicy("process_start").destructive, true);
  assert.equal(getToolPolicy("process_start").open_world, true);
  assert.equal(getToolPolicy("process_start").uses_fs, true);
  assert.equal(getToolPolicy("process_cancel").destructive, true);
  assert.equal(getToolPolicy("process_status").read_only, true);
  assert.equal(getToolPolicy("process_output").read_only, true);

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
    assert.deepEqual(decision.decision_meta.reason_codes, ["guarded_process_execution"]);
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
    auditLog() {},
  });
  assert.equal(typeof runtimeAuditCallback, "function");

  const started = await processStartTool.execute({
    command: "node",
    args: ["-e", "process.stdout.write('async-tool-output')"],
    cwd: "mcp-tests",
  }, context);
  assert.equal(started.command, "node");
  assert.equal(started.terminal, false);

  const completed = await waitFor(async () => {
    const status = await processStatusTool.execute({ job_id: started.job_id }, context);
    return status.terminal ? status : null;
  });
  assert.equal(completed.status, "ok");
  assert.throws(
    () => processStatusTool.execute({ job_id: started.job_id }, otherClientContext),
    /Unknown process job/
  );

  const output = await processOutputTool.execute({
    job_id: started.job_id,
    stdout_offset: 0,
    stderr_offset: 0,
    max_chars: 65536,
  }, context);
  assert.equal(output.stdout, "async-tool-output");
  assert.equal(output.stdout_eof, true);

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
  console.log("smoke_process_async_tools ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
