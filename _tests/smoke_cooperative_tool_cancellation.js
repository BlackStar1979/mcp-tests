"use strict";
const assert = require("node:assert/strict");
const { tryHandleOptionalToolCall } = require("../src/runtime/optional_tool_call_handler");
const { isCooperativeToolCancellation } = require("../src/runtime/cooperative_tool_cancellation");

function getOptionalToolFactory(tool) {
  return (name) => (name === "mock_cancel" ? tool : null);
}
function auditSink() {
  const entries = [];
  return { entries, auditLog: (event, payload) => entries.push({ event, payload }) };
}
function abortError() {
  const err = new Error("cancelled");
  err.name = "AbortError";
  err.code = "ABORT_ERR";
  return err;
}
(async () => {
  const preAudit = auditSink();
  const preController = new AbortController();
  preController.abort("pre_cancelled");
  let executed = false;
  const pre = await tryHandleOptionalToolCall({
    id: 1, name: "mock_cancel", args: {}, context: { requestId: "pre", abortSignal: preController.signal },
    startedAt: Date.now(), outputMode: "structured", getOptionalTool: getOptionalToolFactory({ execute: async () => { executed = true; } }), auditLog: preAudit.auditLog,
  });
  assert.equal(executed, false);
  assert.equal(pre.error.data.decision_code, "tool_execution_cancelled");
  assert.equal(pre.error.data.reason, "pre_cancelled");
  assert.ok(preAudit.entries.some((x) => x.event === "tool_call_cancelled_cooperative" && x.payload.phase === "before_execute"));

  const runAudit = auditSink();
  const runController = new AbortController();
  const runPromise = tryHandleOptionalToolCall({
    id: 2, name: "mock_cancel", args: {}, context: { requestId: "run", abortSignal: runController.signal },
    startedAt: Date.now(), outputMode: "structured",
    getOptionalTool: getOptionalToolFactory({
      execute: async (_args, context) => new Promise((resolve, reject) => {
        context.abortSignal.addEventListener("abort", () => reject(abortError()), { once: true });
        setTimeout(() => resolve({ ok: true }), 50);
      }),
    }),
    auditLog: runAudit.auditLog,
  });
  runController.abort("during_execute");
  const run = await runPromise;
  assert.equal(run.error.data.decision_code, "tool_execution_cancelled");
  assert.equal(run.error.data.reason, "during_execute");
  assert.ok(runAudit.entries.some((x) => x.event === "tool_call_cancelled_cooperative" && x.payload.phase === "execute"));
  assert.equal(runAudit.entries.some((x) => x.event === "tool_call_end"), false);
  assert.equal(isCooperativeToolCancellation({ error: abortError(), abortSignal: runController.signal }), true);

  const okAudit = auditSink();
  const okController = new AbortController();
  const ok = await tryHandleOptionalToolCall({
    id: 3, name: "mock_cancel", args: {}, context: { requestId: "ok", abortSignal: okController.signal },
    startedAt: Date.now(), outputMode: "structured", getOptionalTool: getOptionalToolFactory({ execute: async () => ({ ok: true }) }), auditLog: okAudit.auditLog,
  });
  assert.equal(ok.result.structuredContent.ok, true);
  assert.ok(okAudit.entries.some((x) => x.event === "tool_call_end"));
  assert.equal(okAudit.entries.some((x) => x.event === "tool_call_cancelled_cooperative"), false);

  console.log("smoke_cooperative_tool_cancellation ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
