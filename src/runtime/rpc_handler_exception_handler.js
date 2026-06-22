"use strict";

const { jsonResponse } = require("./http_responses");
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
    jsonResponse(
      res,
      500,
      rpcError(payload?.id, -32603, error.message || "Internal server error")
    );
  }
}

module.exports = {
  handleRpcHandlerException,
};
