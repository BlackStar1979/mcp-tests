"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createRequestAbortSignal } = require("../src/runtime/request_cancellation");
const { handleSinglePayload } = require("../src/runtime/single_payload_dispatcher");
const { handleBatchPayloadIfNeeded } = require("../src/runtime/batch_payload_dispatcher");

function res() {
  return {
    statusCode: null,
    headers: {},
    chunks: [],
    writeHead(code, headers) { this.statusCode = code; this.headers = headers || {}; },
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    write(chunk) { this.chunks.push(String(chunk)); },
    end(chunk) { if (chunk) this.chunks.push(String(chunk)); },
    body() { return this.chunks.join(""); },
  };
}

(async () => {
  const req = new EventEmitter();
  req.aborted = false;
  const audit = [];
  const signal = createRequestAbortSignal({
    req,
    requestId: "c1",
    auditLog(event, payload) { audit.push({ event, payload }); },
  });
  assert.equal(signal.aborted, false);
  req.aborted = true;
  req.emit("aborted");
  assert.equal(signal.aborted, true);
  assert.ok(audit.some((entry) => entry.event === "request_cancelled_by_client" && entry.payload.reason === "request_aborted"));

  const singleSignal = new AbortController().signal;
  let singleContext;
  await handleSinglePayload({
    payload: { jsonrpc: "2.0", id: 1, method: "ping", params: {} },
    raw: "{}",
    res: res(),
    auditLog() {},
    requestId: "single",
    sessionId: undefined,
    session: null,
    protocolVersion: "2025-06-18",
    responseMode: "json",
    httpMethod: "POST",
    abortSignal: singleSignal,
    handleRpcMessage: async (_payload, context) => {
      singleContext = context;
      return { jsonrpc: "2.0", id: 1, result: { ok: true } };
    },
  });
  assert.equal(singleContext.abortSignal, singleSignal);

  const batchSignal = new AbortController().signal;
  const batchContexts = [];
  await handleBatchPayloadIfNeeded({
    payload: [
      { jsonrpc: "2.0", id: 1, method: "ping", params: {} },
      { jsonrpc: "2.0", id: 2, method: "ping", params: {} },
    ],
    raw: "[]",
    res: res(),
    auditLog() {},
    requestId: "batch",
    sessionId: undefined,
    session: null,
    protocolVersion: "2025-06-18",
    httpMethod: "POST",
    responseMode: "json",
    abortSignal: batchSignal,
    handleRpcMessage: async (payload, context) => {
      batchContexts.push(context);
      return { jsonrpc: "2.0", id: payload.id, result: { ok: true } };
    },
  });
  assert.equal(batchContexts.length, 2);
  assert.equal(batchContexts[0].abortSignal, batchSignal);
  assert.equal(batchContexts[1].abortSignal, batchSignal);

  console.log("smoke_stage7_c1_cancellation_context_plumbing ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
