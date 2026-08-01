"use strict";

const { emptyResponse, jsonResponse } = require("./http_responses");
const { rpcError } = require("./rpc_responses");
const { rpcMethodSummary } = require("./rpc_audit_summary");
const { auditJsonRpcResponseSent, auditEmptyRpcResponseSent } = require("./rpc_response_audit");
const { isJsonRpcResponse, resolvePendingResponse } = require("./outbound_request_manager");
const { byteLength } = require("./runtime_helpers");
const { skipResponseWriteIfNeeded } = require("./response_write_guard");
const { isModernProtocolVersion } = require("./protocol_version_policy");

const DEFAULT_MAX_BATCH_ITEMS = 25;

function getMaxBatchItems() {
  const parsed = Number(process.env.MCP_TEST_MAX_BATCH_ITEMS || DEFAULT_MAX_BATCH_ITEMS);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 100 ? parsed : DEFAULT_MAX_BATCH_ITEMS;
}

async function handleBatchPayloadIfNeeded({
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
  httpMethod,
  responseMode = "json",
  abortSignal,
  authResult,
  handleRpcMessage,
}) {
  if (!Array.isArray(payload)) {
    return false;
  }

  if (isModernProtocolVersion(protocolVersion)) {
    const response = rpcError(null, -32600, "Invalid Request", { reason: "modern_http_batch_not_supported" });
    auditLog("rpc_protocol_error", { request_id: requestId, reason: "modern_http_batch_not_supported" });
    auditJsonRpcResponseSent(auditLog, { requestId, statusCode: 400, response, batch: true, phase: "modern_http_batch_unsupported" });
    jsonResponse(res, 400, response);
    return true;
  }

  const maxBatchItems = getMaxBatchItems();
  auditLog("rpc_received", {
    request_id: requestId,
    http_method: httpMethod,
    path: "/mcp",
    kind: "batch",
    batch: true,
    batch_length: payload.length,
    max_batch_items: maxBatchItems,
    raw_bytes: byteLength(raw),
    methods: payload.map((item) => rpcMethodSummary(item)),
  });

  if (responseMode === "sse") {
    auditLog("rpc_protocol_error", {
      request_id: requestId,
      reason: "batch_sse_not_supported",
      batch_length: payload.length,
    });
    if (skipResponseWriteIfNeeded({ res, abortSignal, auditLog, requestId, phase: "batch_sse_unsupported" })) return true;
    const response = rpcError(null, -32600, "Invalid Request", {
      reason: "batch_sse_not_supported",
      status: "explicitly_unsupported_for_current_target",
    });
    auditJsonRpcResponseSent(auditLog, { requestId, statusCode: 400, response, batch: true, phase: "batch_sse_unsupported" });
    jsonResponse(res, 400, response);
    return true;
  }

  if (payload.length > maxBatchItems) {
    auditLog("rpc_protocol_error", {
      request_id: requestId,
      reason: "batch_too_large",
      batch_length: payload.length,
      max_batch_items: maxBatchItems,
    });
    if (skipResponseWriteIfNeeded({ res, abortSignal, auditLog, requestId, phase: "batch_too_large" })) return true;
    const response = rpcError(null, -32600, "Invalid Request", {
      reason: "batch_too_large",
      max_batch_items: maxBatchItems,
    });
    auditJsonRpcResponseSent(auditLog, { requestId, statusCode: 200, response, batch: true, phase: "batch_too_large" });
    jsonResponse(res, 200, response);
    return true;
  }

  const responseItems = payload.filter((item) => isJsonRpcResponse(item));
  if (responseItems.length > 0) {
    if (responseItems.length !== payload.length) {
      if (!skipResponseWriteIfNeeded({ res, abortSignal, auditLog, requestId, phase: "mixed_batch_responses_not_supported" })) {
        const response = rpcError(null, -32600, "Invalid Request", { reason: "mixed_batch_responses_not_supported" });
        auditJsonRpcResponseSent(auditLog, { requestId, statusCode: 400, response, batch: true, phase: "mixed_batch_responses_not_supported" });
        jsonResponse(res, 400, response);
      }
      return true;
    }
    for (const item of responseItems) {
      const resolved = resolvePendingResponse(session, item);
      if (!resolved.ok) {
        auditLog("pending_response_rejected", { request_id: requestId, reason: resolved.reason, rpc_id: resolved.id });
        if (!skipResponseWriteIfNeeded({ res, abortSignal, auditLog, requestId, phase: "batch_pending_rejected" })) {
          const response = rpcError(item.id, -32000, "Pending response rejected", { reason: resolved.reason });
          auditJsonRpcResponseSent(auditLog, { requestId, statusCode: 400, response, batch: true, phase: "batch_pending_rejected" });
          jsonResponse(res, 400, response);
        }
        return true;
      }
      auditLog("pending_response_resolved", { request_id: requestId, rpc_id: resolved.id, method: resolved.method, has_error: resolved.hasError });
    }
    if (!skipResponseWriteIfNeeded({ res, abortSignal, auditLog, requestId, phase: "batch_pending_resolved" })) {
      auditEmptyRpcResponseSent(auditLog, { requestId, statusCode: 202, phase: "batch_pending_resolved", batch: true });
      emptyResponse(res, 202);
    }
    return true;
  }

  const responses = [];

  for (const item of payload) {
    const response = await handleRpcMessage(item || {}, { requestId, sessionId, session, protocolVersion, protocolVersionHeader, requestHeaders, abortSignal, authResult });

    if (response !== undefined) {
      responses.push(response);
    }
  }

  if (responses.length === 0) {
    if (!skipResponseWriteIfNeeded({ res, abortSignal, auditLog, requestId, phase: "batch_no_response" })) {
      auditEmptyRpcResponseSent(auditLog, { requestId, statusCode: 204, phase: "batch_no_response", batch: true });
      emptyResponse(res, 204);
    }
    return true;
  }

  if (!skipResponseWriteIfNeeded({ res, abortSignal, auditLog, requestId, phase: "batch_json_response" })) {
    auditJsonRpcResponseSent(auditLog, { requestId, statusCode: 200, response: responses, batch: true, phase: "batch_json_response" });
    jsonResponse(res, 200, responses);
  }
  return true;
}

module.exports = {
  DEFAULT_MAX_BATCH_ITEMS,
  getMaxBatchItems,
  handleBatchPayloadIfNeeded,
};
