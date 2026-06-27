"use strict";

const { rpcResult } = require("./rpc_responses");
const { buildToolsListResponse } = require("./tools_list_response");

function handleToolsListMessage(id, tools, options = {}) {
  const response = buildToolsListResponse(tools, options);
  const meta = response._meta || {};
  if (typeof options.auditLog === "function") {
    const base = {
      request_id: options.requestId,
      session_id: options.sessionId || "",
      auth_mode: options.authMode || "unknown",
      tool_count: response.tools.length,
      fingerprint: meta["mcp-tests/toolSurfaceFingerprint"] || "",
      tool_names_hash: meta["mcp-tests/toolNamesHash"] || "",
      server_start_id: meta["mcp-tests/serverStartId"] || "",
    };
    options.auditLog("tools_list_served", base);
    options.auditLog("tools_list_cache_directive", {
      request_id: options.requestId,
      session_id: options.sessionId || "",
      ttl_ms: response.ttlMs,
      cache_scope: response.cacheScope,
      fingerprint: base.fingerprint,
      server_start_id: base.server_start_id,
    });
  }
  return rpcResult(id, response);
}

module.exports = {
  handleToolsListMessage,
};
