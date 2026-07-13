"use strict";

const { jsonResponse } = require("./http_responses");
const { auditJsonRpcResponseSent } = require("./rpc_response_audit");

function handleMethodNotAllowed({ res, auditLog, requestId, httpMethod }) {
  auditLog("rpc_received", {
    request_id: requestId,
    http_method: httpMethod,
    path: "/mcp",
    kind: "method_not_allowed",
    raw_bytes: 0,
  });

  const response = {
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed. Use POST /mcp.",
    },
    id: null,
  };
  auditJsonRpcResponseSent(auditLog, { requestId, statusCode: 405, response, phase: "method_not_allowed" });
  jsonResponse(res, 405, response);
}

module.exports = {
  handleMethodNotAllowed,
};
