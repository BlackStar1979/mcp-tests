"use strict";

const { encodeSseEvent } = require("./sse_response");

const DEFAULT_PENDING_TIMEOUT_MS = 30 * 1000;

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

function nextServerRequestId(session) {
  session.nextOutboundId = Number(session.nextOutboundId || 0) + 1;
  return `srv_${session.nextOutboundId}`;
}

function sendSessionRequest(session, { method, params = {}, timeoutMs = DEFAULT_PENDING_TIMEOUT_MS } = {}) {
  if (!session) throw new Error("Session is required");
  if (typeof method !== "string" || method.trim() === "") throw new Error("Method is required");
  const id = nextServerRequestId(session);
  const envelope = { jsonrpc: "2.0", id, method, params };
  let timeoutHandle;
  const promise = new Promise((resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      session.pending.delete(id);
      reject(new Error(`Pending request timed out: ${id}`));
    }, timeoutMs);
    if (typeof timeoutHandle.unref === "function") timeoutHandle.unref();
    session.pending.set(id, { resolve, reject, timeoutHandle, method, createdAt: Date.now() });
  });
  session.enqueueOutbound(encodeSseEvent({ event: "message", data: envelope }));
  return { id, envelope, promise };
}

function resolvePendingResponse(session, message) {
  if (!isJsonRpcResponse(message)) return { ok: false, reason: "not_json_rpc_response" };
  if (!session) return { ok: false, reason: "missing_session" };
  const pending = session.pending.get(message.id);
  if (!pending) return { ok: false, reason: "unknown_pending_id", id: message.id };
  clearTimeout(pending.timeoutHandle);
  session.pending.delete(message.id);
  pending.resolve(message);
  return { ok: true, id: message.id, method: pending.method, hasError: Object.prototype.hasOwnProperty.call(message, "error") };
}

module.exports = {
  DEFAULT_PENDING_TIMEOUT_MS,
  isJsonRpcResponse,
  resolvePendingResponse,
  sendSessionRequest,
};
