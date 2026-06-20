"use strict";

const { authResponseHeaders, summarizeAuthFailure } = require("../auth/auth_policy");
const { jsonResponse } = require("./http_responses");
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

  jsonResponse(
    res,
    authResult.status || 401,
    rpcError(null, -32001, "Unauthorized", {
      auth_mode: authResult.mode,
      auth_error: authResult.error,
    }),
    authResponseHeaders(authPolicy)
  );
}

module.exports = {
  handleAuthRejection,
};
