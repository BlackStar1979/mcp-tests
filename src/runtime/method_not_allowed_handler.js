"use strict";

const { methodNotAllowed } = require("./http_responses");

function handleMethodNotAllowed({ res, auditLog, requestId, httpMethod }) {
  auditLog("rpc_received", {
    request_id: requestId,
    http_method: httpMethod,
    path: "/mcp",
    kind: "method_not_allowed",
    raw_bytes: 0,
  });

  methodNotAllowed(res);
}

module.exports = {
  handleMethodNotAllowed,
};
