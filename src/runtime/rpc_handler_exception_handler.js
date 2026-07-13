"use strict";

const { jsonResponse } = require("./http_responses");
const { auditJsonRpcResponseSent } = require("./rpc_response_audit");
const { rpcError } = require("./rpc_responses");
const { skipResponseWriteIfNeeded } = require("./response_write_guard");

function handleRpcHandlerException({
  res,
  auditLog,
  requestId,
  payload,
  error,
  abortSignal,
}) {
  auditLog("tool_call_error", {
    request_id: requestId,
    error_kind: "rpc_handler_exception",
    error_message: error?.message || String(error),
  });

  if (!skipResponseWriteIfNeeded({ res, abortSignal, auditLog, requestId, phase: "rpc_handler_exception" })) {
    const response = rpcError(payload?.id, -32603, error.message || "Internal server error");
    auditJsonRpcResponseSent(auditLog, { requestId, statusCode: 500, response, phase: "rpc_handler_exception" });
    jsonResponse(res, 500, response);
  }
}

module.exports = {
  handleRpcHandlerException,
};
