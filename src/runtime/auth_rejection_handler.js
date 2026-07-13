"use strict";

const { authResponseHeaders, summarizeAuthFailure } = require("../auth/auth_policy");
const { jsonResponse } = require("./http_responses");
const { auditJsonRpcResponseSent } = require("./rpc_response_audit");
const { rpcError } = require("./rpc_responses");

function handleAuthRejection({
  res,
  auditLog,
  requestId,
  httpMethod,
  authResult,
  authPolicy,
}) {
  auditLog("rpc_received", {
    request_id: requestId,
    http_method: httpMethod,
    path: "/mcp",
    kind: "auth_rejected",
    raw_bytes: 0,
    ...summarizeAuthFailure(authResult),
  });

  const statusCode = authResult.status || 401;
  const response = rpcError(null, -32001, "Unauthorized", {
    auth_mode: authResult.mode,
    auth_error: authResult.error,
  });
  auditJsonRpcResponseSent(auditLog, { requestId, statusCode, response, phase: "auth_rejected" });
  jsonResponse(
    res,
    statusCode,
    response,
    authResponseHeaders(authPolicy)
  );
}

module.exports = {
  handleAuthRejection,
};
