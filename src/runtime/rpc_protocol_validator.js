"use strict";

const VALID_ID_TYPES = new Set(["string", "number"]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function summarizeInvalidId(message) {
  if (!isObject(message)) return null;
  if (!Object.prototype.hasOwnProperty.call(message, "id")) return null;
  const id = message.id;
  if (VALID_ID_TYPES.has(typeof id)) return id;
  return null;
}

function validateRpcMessage(message) {
  const id = summarizeInvalidId(message);
  if (!isObject(message)) {
    return { ok: false, id: null, code: -32600, message: "Invalid Request", reason: "request_must_be_object" };
  }
  if (message.jsonrpc !== "2.0") {
    return { ok: false, id, code: -32600, message: "Invalid Request", reason: "jsonrpc_must_be_2_0" };
  }
  if (typeof message.method !== "string" || message.method.trim() === "") {
    return { ok: false, id, code: -32600, message: "Invalid Request", reason: "method_must_be_non_empty_string" };
  }
  if (Object.prototype.hasOwnProperty.call(message, "id")) {
    const value = message.id;
    if (!VALID_ID_TYPES.has(typeof value)) {
      return { ok: false, id: null, code: -32600, message: "Invalid Request", reason: "id_must_be_string_or_number" };
    }
  }
  if (Object.prototype.hasOwnProperty.call(message, "params") && message.params !== undefined && !isObject(message.params)) {
    return { ok: false, id, code: -32602, message: "Invalid params", reason: "params_must_be_object" };
  }
  return {
    ok: true,
    id: Object.prototype.hasOwnProperty.call(message, "id") ? message.id : undefined,
    method: message.method,
    params: message.params || {},
    notification: !Object.prototype.hasOwnProperty.call(message, "id"),
  };
}

module.exports = { validateRpcMessage };
