"use strict";

const assert = require("node:assert/strict");
const { handleBatchPayloadIfNeeded } = require("../src/runtime/batch_payload_dispatcher");

function makeRes() {
  return {
    statusCode: null,
    headers: null,
    chunks: [],
    writeHead(code, headers) { this.statusCode = code; this.headers = headers || {}; },
    write(chunk) { this.chunks.push(String(chunk)); },
    end(chunk) { if (chunk) this.chunks.push(String(chunk)); },
    body() { return this.chunks.join(""); },
  };
}

(async () => {
  const payload = [
    { jsonrpc: "2.0", id: 1, method: "ping", params: {} },
    { jsonrpc: "2.0", id: 2, method: "ping", params: {} },
  ];
  const audit = [];
  const res = makeRes();
  let executed = false;

  const handled = await handleBatchPayloadIfNeeded({
    payload,
    raw: JSON.stringify(payload),
    res,
    auditLog(event, data) { audit.push({ event, data }); },
    requestId: "batch-sse",
    httpMethod: "POST",
    responseMode: "sse",
    handleRpcMessage: async () => { executed = true; throw new Error("batch SSE must not dispatch items"); },
  });

  assert.equal(handled, true);
  assert.equal(executed, false);
  assert.equal(res.statusCode, 400);
  assert.ok(res.headers["content-type"].startsWith("application/json"));
  const body = JSON.parse(res.body());
  assert.equal(body.error.data.reason, "batch_sse_not_supported");
  assert.equal(body.error.data.status, "explicitly_unsupported_for_current_target");
  assert.ok(audit.some((entry) => entry.event === "rpc_protocol_error" && entry.data.reason === "batch_sse_not_supported"));

  console.log("smoke_batch_sse_unsupported_guard ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
