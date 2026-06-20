"use strict";

const { jsonResponse } = require("./http_responses");
const { rpcError } = require("./rpc_responses");

function handleRpcHandlerException({
  res,
  auditLog,
  requestId,
  payload,
  error,
}) {
  auditLog("tool_call_error", {
    request_id: requestId,
    error_kind: "rpc_handler_exception",
    error_message: error?.message || String(error),
  });

  jsonResponse(
    res,
    500,
    rpcError(payload?.id, -32603, error.message || "Internal server error")
  );
}

module.exports = {
  handleRpcHandlerException,
};
