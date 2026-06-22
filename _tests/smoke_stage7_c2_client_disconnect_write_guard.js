"use strict";

const assert = require("node:assert/strict");
const { handleSinglePayload } = require("../src/runtime/single_payload_dispatcher");
const { handleBatchPayloadIfNeeded } = require("../src/runtime/batch_payload_dispatcher");
const { handleRpcHandlerException } = require("../src/runtime/rpc_handler_exception_handler");

function guardedRes() {
  return {
    writes: 0,
    writeHead() { this.writes += 1; throw new Error("writeHead must not be called after abort"); },
    setHeader() { this.writes += 1; throw new Error("setHeader must not be called after abort"); },
    write() { this.writes += 1; throw new Error("write must not be called after abort"); },
    end() { this.writes += 1; throw new Error("end must not be called after abort"); },
  };
}

(async () => {
  const audit = [];
  const auditLog = (event, payload) => audit.push({ event, payload });

  const singleAbort = new AbortController();
  const singleRes = guardedRes();
  await handleSinglePayload({
    payload: { jsonrpc: "2.0", id: 1, method: "ping", params: {} },
    raw: "{}",
    res: singleRes,
    auditLog,
    requestId: "single-abort",
    protocolVersion: "2025-06-18",
    responseMode: "json",
    httpMethod: "POST",
    abortSignal: singleAbort.signal,
    handleRpcMessage: async () => {
      singleAbort.abort("request_aborted");
      return { jsonrpc: "2.0", id: 1, result: { ok: true } };
    },
  });
  assert.equal(singleRes.writes, 0);
  assert.ok(audit.some((entry) => entry.event === "response_write_skipped_after_client_disconnect" && entry.payload.phase === "single_json_response"));

  const batchAbort = new AbortController();
  const batchRes = guardedRes();
  await handleBatchPayloadIfNeeded({
    payload: [{ jsonrpc: "2.0", id: 1, method: "ping", params: {} }],
    raw: "[]",
    res: batchRes,
    auditLog,
    requestId: "batch-abort",
    protocolVersion: "2025-06-18",
    responseMode: "json",
    httpMethod: "POST",
    abortSignal: batchAbort.signal,
    handleRpcMessage: async (payload) => {
      batchAbort.abort("request_aborted");
      return { jsonrpc: "2.0", id: payload.id, result: { ok: true } };
    },
  });
  assert.equal(batchRes.writes, 0);
  assert.ok(audit.some((entry) => entry.event === "response_write_skipped_after_client_disconnect" && entry.payload.phase === "batch_json_response"));

  const errorAbort = new AbortController();
  errorAbort.abort("request_aborted");
  const errorRes = guardedRes();
  handleRpcHandlerException({
    res: errorRes,
    auditLog,
    requestId: "error-abort",
    payload: { jsonrpc: "2.0", id: 3, method: "boom" },
    error: new Error("boom"),
    abortSignal: errorAbort.signal,
  });
  assert.equal(errorRes.writes, 0);
  assert.ok(audit.some((entry) => entry.event === "response_write_skipped_after_client_disconnect" && entry.payload.phase === "rpc_handler_exception"));

  console.log("smoke_stage7_c2_client_disconnect_write_guard ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
