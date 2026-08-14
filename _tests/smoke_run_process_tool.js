"use strict";

const assert = require("node:assert/strict");

const { runProcessTool } = require("../tools/run_process");
const { resolveTraceContext } = require("../src/runtime/trace_context");

(async () => {
  const result = await runProcessTool.execute({
    command: "node",
    args: ["-e", "console.log('run-process-ok')"],
    cwd: ".",
    timeout_ms: 5000,
  });

  assert.equal(runProcessTool.name, "run_process");
  assert.equal(result.status, "ok");
  assert.equal(result.command, "node");
  assert.equal(result.timed_out, false);
  assert.deepEqual(result.args, [], "run_process must not echo raw argv into the tool result");
  assert.match(result.stdout, /run-process-ok/);

  const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
  const requestTrace = resolveTraceContext({
    traceparent: `00-${traceId}-00f067aa0ba902b7-01`,
    baggage: "secret=never-return-this",
  });
  const audit = [];
  const traced = await runProcessTool.execute({
    command: "node",
    args: ["-e", "console.log('run-process-traced')"],
    cwd: ".",
    timeout_ms: 5000,
  }, {
    requestId: "req-run-process-trace",
    traceContext: requestTrace,
    auditLog(event, fields) { audit.push({ event, ...fields }); },
  });
  assert.equal(traced.status, "ok");
  assert.equal(traced.trace_id, traceId);
  assert.equal(JSON.stringify(traced).includes("never-return-this"), false);
  const traceAudit = audit.find((entry) => entry.event === "process_execution_trace");
  assert.equal(traceAudit.trace_id, traceId);
  assert.equal(traceAudit.parent_span_id, requestTrace.spanId);
  assert.match(traceAudit.span_id, /^[0-9a-f]{16}$/);
  assert.notEqual(traceAudit.span_id, requestTrace.spanId);
  assert.equal(JSON.stringify(traceAudit).includes("never-return-this"), false);

  console.log("smoke_run_process_tool ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
