"use strict";

const assert = require("node:assert/strict");
const {
  isJsonRpcResponse,
  rejectClientResponseEnvelope,
} = require("../src/runtime/outbound_request_manager");
const { handleSinglePayload } = require("../src/runtime/single_payload_dispatcher");
const { handleBatchPayloadIfNeeded } = require("../src/runtime/batch_payload_dispatcher");

function responseRecorder() {
  return {
    statusCode: null,
    headers: {},
    chunks: [],
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers || {};
    },
    write(chunk) {
      this.chunks.push(String(chunk));
    },
    end(chunk) {
      if (chunk) this.chunks.push(String(chunk));
      this.ended = true;
    },
    body() {
      return this.chunks.join("");
    },
  };
}

(async () => {
  const responseEnvelope = { jsonrpc: "2.0", id: "srv_stale", result: { ok: true } };
  assert.equal(isJsonRpcResponse(responseEnvelope), true);
  assert.equal(typeof rejectClientResponseEnvelope, "function");
  assert.deepEqual(rejectClientResponseEnvelope(responseEnvelope), {
    ok: false,
    reason: "server_initiated_requests_not_active",
    id: "srv_stale",
  });
  assert.deepEqual(rejectClientResponseEnvelope({ jsonrpc: "2.0", method: "tools/list", id: 1 }), {
    ok: false,
    reason: "not_json_rpc_response",
  });

  const audit = [];
  const auditLog = (event, payload) => audit.push({ event, payload });
  const staleSession = {
    pending: new Map([["srv_stale", { resolve() { throw new Error("must not resolve retired pending state"); } }]]),
  };
  const single = responseRecorder();
  await handleSinglePayload({
    payload: responseEnvelope,
    raw: "{}",
    res: single,
    auditLog,
    requestId: "single",
    sessionId: "legacy-session",
    session: staleSession,
    protocolVersion: "2025-06-18",
    httpMethod: "POST",
    handleRpcMessage: async () => { throw new Error("must not dispatch a response envelope"); },
  });
  assert.equal(single.statusCode, 400);
  assert.equal(JSON.parse(single.body()).error.data.reason, "server_initiated_requests_not_active");

  const batch = responseRecorder();
  const handled = await handleBatchPayloadIfNeeded({
    payload: [responseEnvelope],
    raw: "[]",
    res: batch,
    auditLog,
    requestId: "batch",
    sessionId: "legacy-session",
    session: staleSession,
    protocolVersion: "2025-03-26",
    httpMethod: "POST",
    handleRpcMessage: async () => { throw new Error("must not dispatch a response envelope batch"); },
  });
  assert.equal(handled, true);
  assert.equal(batch.statusCode, 400);
  assert.equal(JSON.parse(batch.body()).error.data.reason, "server_initiated_requests_not_active");
  assert.equal(staleSession.pending.size, 1);
  assert.equal(
    audit.filter((entry) => entry.event === "client_response_envelope_rejected"
      && entry.payload.reason === "server_initiated_requests_not_active").length,
    2,
  );
  console.log("smoke_pending_request_correlation ok");
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
