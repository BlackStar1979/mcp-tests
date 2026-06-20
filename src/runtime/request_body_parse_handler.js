"use strict";

const { byteLength } = require("./runtime_helpers");
const { jsonResponse } = require("./http_responses");
const { rpcError } = require("./rpc_responses");
const { readRequestBody } = require("./request_body");

async function parseRpcRequestBodyOrHandleError({
  req,
  res,
  auditLog,
  requestId,
  httpMethod,
}) {
  let raw = "";

  try {
    raw = await readRequestBody(req);
    return {
      ok: true,
      raw,
      payload: JSON.parse(raw || "null"),
    };
  } catch (error) {
    auditLog("rpc_received", {
      request_id: requestId,
      http_method: httpMethod,
      path: "/mcp",
      kind: "parse_error",
      raw_bytes: byteLength(raw),
      error_message: error?.message || String(error),
    });

    jsonResponse(res, 400, rpcError(null, -32700, "Parse error"));

    return {
      ok: false,
      raw,
      payload: undefined,
      error,
    };
  }
}

module.exports = {
  parseRpcRequestBodyOrHandleError,
};
