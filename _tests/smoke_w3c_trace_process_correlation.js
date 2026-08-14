"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { validatePerRequestMetadata } = require("../src/runtime/request_metadata_policy");
const { createProcessJobManager } = require("../src/util/process_job_manager");
const { PROCESS_RUNNER_CONFIG } = require("../src/util/process_runner_config");
const { createChildTraceContext, resolveTraceContext } = require("../src/runtime/trace_context");

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const PARENT_SPAN_ID = "00f067aa0ba902b7";

function message(traceparent) {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "run_process",
      arguments: { command: "fixture" },
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        traceparent,
        tracestate: "vendor=value",
        baggage: "secret=do-not-persist",
      },
    },
  };
}

function prepared() {
  return {
    timeoutMs: 5000,
    outputLimit: 10000,
    invocation: {
      logicalCommand: "fixture",
      originalArgs: [],
      family: "runtime",
      resolutionClass: "fixture",
      cwdInfo: { absolutePath: process.cwd(), displayPath: ".", rootAlias: "mcp-tests" },
    },
  };
}

function fakeExecution() {
  const result = {
    status: "ok",
    exit_code: 0,
    signal: null,
    timed_out: false,
    stdout: "done\n",
    stderr: "",
    stdout_truncated: false,
    stderr_truncated: false,
    error: null,
  };
  return {
    completion: Promise.resolve(result),
    snapshot: () => ({ stdout_chars: 0, stderr_chars: 0, stdout_truncated: false, stderr_truncated: false }),
    readOutput: () => ({ stdout: "done\n", stderr: "", stdout_next_offset: 5, stderr_next_offset: 0, stdout_eof: true, stderr_eof: true }),
    cancel: async () => ({ ...result, status: "cancelled", exit_code: null }),
  };
}

async function waitForTerminal(manager, jobId) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const status = manager.status(jobId, { ownerId: "client-a" });
    if (status.terminal) return status;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("fixture process did not become terminal");
}

function assertTrace(trace, executionTrace, requestTrace) {
  assert.equal(trace.trace_id, TRACE_ID);
  assert.equal(trace.span_id, executionTrace.spanId);
  assert.equal(trace.parent_span_id, requestTrace.spanId);
  assert.equal(trace.trace_flags, "01");
  assert.equal(trace.trace_source, "internal_child");
  assert.equal(JSON.stringify(trace).includes("do-not-persist"), false);
}

(async () => {
  const metadata = validatePerRequestMetadata({
    protocolVersionHeader: "2026-07-28",
    message: message(`00-${TRACE_ID}-${PARENT_SPAN_ID}-01`),
  });
  assert.equal(metadata.ok, true);
  assert.equal(metadata.traceContext.traceId, TRACE_ID);
  assert.equal(metadata.traceContext.parentSpanId, PARENT_SPAN_ID);
  assert.match(metadata.traceContext.spanId, /^[0-9a-f]{16}$/);
  assert.equal(Object.hasOwn(metadata.traceContext, "baggage"), false);

  const requestTrace = resolveTraceContext({ traceparent: `00-${TRACE_ID}-${PARENT_SPAN_ID}-01` });
  const executionTrace = createChildTraceContext(requestTrace);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-w3c-trace-"));
  const storageFile = path.join(tempRoot, "jobs.sqlite");
  const config = Object.freeze({ ...PROCESS_RUNNER_CONFIG, maxConcurrent: 1, maxQueued: 2, maxRetained: 16, retentionMs: 60000 });
  const managerOptions = {
    config,
    storageFile,
    runtimeScope: "trace-smoke",
    idempotencySecret: "trace-smoke-idempotency-secret",
    prepareExecution: prepared,
    startExecution: fakeExecution,
  };
  let first = null;
  let second = null;
  try {
    first = createProcessJobManager({ ...managerOptions, serverInstanceId: "trace-one" });
    const created = first.start(
      { command: "fixture" },
      { ownerId: "client-a" },
      { traceContext: executionTrace }
    );
    assertTrace(first.trace(created.job_id, { ownerId: "client-a" }), executionTrace, requestTrace);

    const taskId = created.job_id;
    await waitForTerminal(first, taskId);
    first.close();
    first = null;

    second = createProcessJobManager({ ...managerOptions, serverInstanceId: "trace-two" });
    assertTrace(second.trace(taskId, { ownerId: "client-a" }), executionTrace, requestTrace);
    assert.throws(
      () => second.trace(taskId, { ownerId: "client-b", traceContext: executionTrace }),
      (error) => error?.code === "process_job_not_found"
    );
  } finally {
    first?.close();
    second?.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log("smoke_w3c_trace_process_correlation ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
