"use strict";

const assert = require("node:assert/strict");
const { handleSinglePayload } = require("../src/runtime/single_payload_dispatcher");
const { handleBatchPayloadIfNeeded } = require("../src/runtime/batch_payload_dispatcher");

function responseStub() {
  return {
    writableEnded: false,
    headersSent: false,
    statusCode: 0,
    setHeader() {},
    writeHead(statusCode) { this.statusCode = statusCode; },
    end() { this.writableEnded = true; },
  };
}

(async () => {
  const authResult = {
    subject: "operator",
    clientId: "client-1",
    scopes: ["mcp:tools"],
  };
  const payload = { jsonrpc: "2.0", id: 1, method: "ping", params: {} };
  let singleContext = null;
  await handleSinglePayload({
    payload,
    raw: JSON.stringify(payload),
    res: responseStub(),
    auditLog() {},
    requestId: "single-1",
    sessionId: undefined,
    session: null,
    protocolVersion: "2025-06-18",
    protocolVersionHeader: "2025-06-18",
    responseMode: "json",
    httpMethod: "POST",
    abortSignal: new AbortController().signal,
    authResult,
    async handleRpcMessage(_message, context) {
      singleContext = context;
      return undefined;
    },
  });
  assert.deepEqual(singleContext.authResult, authResult);

  let batchContext = null;
  const handled = await handleBatchPayloadIfNeeded({
    payload: [payload],
    raw: JSON.stringify([payload]),
    res: responseStub(),
    auditLog() {},
    requestId: "batch-1",
    sessionId: undefined,
    session: null,
    protocolVersion: "2025-06-18",
    protocolVersionHeader: "2025-06-18",
    responseMode: "json",
    httpMethod: "POST",
    abortSignal: new AbortController().signal,
    authResult,
    async handleRpcMessage(_message, context) {
      batchContext = context;
      return undefined;
    },
  });
  assert.equal(handled, true);
  assert.deepEqual(batchContext.authResult, authResult);

  console.log("smoke_mcp_auth_context_plumbing ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
