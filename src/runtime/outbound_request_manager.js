"use strict";

// The active server does not initiate JSON-RPC requests. Keep response-envelope
// classification explicit so stale or unsolicited client responses fail closed.

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isJsonRpcResponse(message) {
  return isObject(message)
    && message.jsonrpc === "2.0"
    && !Object.prototype.hasOwnProperty.call(message, "method")
    && Object.prototype.hasOwnProperty.call(message, "id")
    && (typeof message.id === "string" || typeof message.id === "number")
    && (Object.prototype.hasOwnProperty.call(message, "result") || Object.prototype.hasOwnProperty.call(message, "error"));
}

function rejectClientResponseEnvelope(message) {
  if (!isJsonRpcResponse(message)) return { ok: false, reason: "not_json_rpc_response" };
  return { ok: false, reason: "server_initiated_requests_not_active", id: message.id };
}

module.exports = {
  isJsonRpcResponse,
  rejectClientResponseEnvelope,
};
