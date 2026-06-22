"use strict";

const { emptyResponse, jsonResponse } = require("./http_responses");
const { sseResponse } = require("./sse_response");
const { isJsonRpcResponse, resolvePendingResponse } = require("./outbound_request_manager");
const { rpcMethodSummary } = require("./rpc_audit_summary");
const { byteLength } = require("./runtime_helpers");

async function handleSinglePayload({
  payload,
  raw,
  res,
  auditLog,
  requestId,
  sessionId,
  session,
  protocolVersion,
  responseMode = "json",
  httpMethod,
  abortSignal,
  handleRpcMessage,
}) {
  auditLog("rpc_received", {
    request_id: requestId,
    http_method: httpMethod,
    path: "/mcp",
    kind: "single",
    batch: false,
    raw_bytes: byteLength(raw),
    ...rpcMethodSummary(payload),
  });

  if (isJsonRpcResponse(payload)) {
    const resolved = resolvePendingResponse(session, payload);
    if (!resolved.ok) {
      auditLog("pending_response_rejected", { request_id: requestId, reason: resolved.reason, rpc_id: resolved.id });
      jsonResponse(res, 400, { jsonrpc: "2.0", id: payload.id, error: { code: -32000, message: "Pending response rejected", data: { reason: resolved.reason } } });
      return;
    }
    auditLog("pending_response_resolved", { request_id: requestId, rpc_id: resolved.id, method: resolved.method, has_error: resolved.hasError });
    emptyResponse(res, 202);
    return;
  }

  const response = await handleRpcMessage(payload || {}, { requestId, sessionId, session, protocolVersion, abortSignal });

  if (response === undefined) {
    emptyResponse(res, 204);
    return;
  }

  if (responseMode === "sse") {
    sseResponse(res, { data: response, close: true });
    return;
  }

  jsonResponse(res, 200, response);
}

module.exports = {
  handleSinglePayload,
};
