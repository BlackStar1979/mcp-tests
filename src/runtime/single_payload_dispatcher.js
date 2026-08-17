"use strict";

const { emptyResponse, jsonResponse } = require("./http_responses");
const { sseResponse } = require("./sse_response");
const { isJsonRpcResponse, rejectClientResponseEnvelope } = require("./outbound_request_manager");
const { rpcMethodSummary } = require("./rpc_audit_summary");
const { auditJsonRpcResponseSent, auditEmptyRpcResponseSent } = require("./rpc_response_audit");
const { byteLength } = require("./runtime_helpers");
const { skipResponseWriteIfNeeded } = require("./response_write_guard");
const { modernHttpStatusForResponse } = require("./modern_protocol_adapter");

async function handleSinglePayload({
  payload,
  raw,
  res,
  auditLog,
  requestId,
  sessionId,
  session,
  protocolVersion,
  protocolVersionHeader,
  requestHeaders,
  responseMode = "json",
  httpMethod,
  abortSignal,
  authResult,
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
    const rejected = rejectClientResponseEnvelope(payload);
    auditLog("client_response_envelope_rejected", { request_id: requestId, reason: rejected.reason, rpc_id: rejected.id });
    if (!skipResponseWriteIfNeeded({ res, abortSignal, auditLog, requestId, phase: "single_client_response_rejected" })) {
      const response = { jsonrpc: "2.0", id: payload.id, error: { code: -32000, message: "Client response envelope rejected", data: { reason: rejected.reason } } };
      auditJsonRpcResponseSent(auditLog, { requestId, statusCode: 400, response, phase: "single_client_response_rejected" });
      jsonResponse(res, 400, response);
    }
    return;
  }

  const response = await handleRpcMessage(payload || {}, { requestId, sessionId, session, protocolVersion, protocolVersionHeader, requestHeaders, abortSignal, authResult });

  if (response === undefined) {
    if (!skipResponseWriteIfNeeded({ res, abortSignal, auditLog, requestId, phase: "single_no_response" })) {
      auditEmptyRpcResponseSent(auditLog, { requestId, statusCode: 204, phase: "single_no_response" });
      emptyResponse(res, 204);
    }
    return;
  }

  if (responseMode === "sse") {
    if (!skipResponseWriteIfNeeded({ res, abortSignal, auditLog, requestId, phase: "single_sse_response" })) {
      sseResponse(res, { data: response, close: true });
    }
    return;
  }

  if (!skipResponseWriteIfNeeded({ res, abortSignal, auditLog, requestId, phase: "single_json_response" })) {
    const statusCode = modernHttpStatusForResponse(protocolVersion, response);
    auditJsonRpcResponseSent(auditLog, { requestId, statusCode, response, phase: "single_json_response" });
    jsonResponse(res, statusCode, response);
  }
}

module.exports = {
  handleSinglePayload,
};
