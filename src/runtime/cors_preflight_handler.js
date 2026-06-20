"use strict";

const { corsHeadersForRequest } = require("./cors_policy");

function handleCorsPreflight({ req, res, auditLog, requestId, httpMethod, authPolicy, publicBaseUrl }) {
  auditLog("rpc_received", {
    request_id: requestId,
    http_method: httpMethod,
    path: "/mcp",
    kind: "cors_preflight",
    raw_bytes: 0,
  });

  res.writeHead(204, {
    ...corsHeadersForRequest(req, { authPolicy, publicBaseUrl }),
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      "Content-Type, Accept, Authorization, Cf-Access-Jwt-Assertion, cf-access-jwt-assertion, Mcp-Session-Id, mcp-session-id, Mcp-Protocol-Version, mcp-protocol-version",
    "access-control-max-age": "3600",
    "cache-control": "no-store",
  });
  res.end();
}

module.exports = {
  handleCorsPreflight,
};
