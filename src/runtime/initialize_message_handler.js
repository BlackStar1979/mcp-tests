"use strict";

const { rpcResult } = require("./rpc_responses");
const { buildInitializeResponse } = require("./initialize_response");

function handleInitializeMessage({
  id,
  params,
  serverName,
  serverVersion,
  connectorShapeVersion,
  outputMode,
  authMode,
  profile,
  tools,
  serverStartId,
  auditLog,
  requestId,
  sessionId,
}) {
  if (typeof auditLog === "function") {
    auditLog("initialize_received", {
      request_id: requestId,
      session_id: sessionId || "",
      protocol_version: params?.protocolVersion || "",
      client_name: params?.clientInfo?.name || "",
      client_version: params?.clientInfo?.version || "",
      has_capabilities: Boolean(params?.capabilities),
      auth_mode: authMode,
      profile,
      server_start_id: typeof serverStartId === "string" ? serverStartId : "",
    });
  }
  return rpcResult(id, buildInitializeResponse({
    protocolVersion: params.protocolVersion,
    serverName,
    serverVersion,
    connectorShapeVersion,
    outputMode,
    authMode,
    profile,
    tools,
    serverStartId,
  }));
}

module.exports = {
  handleInitializeMessage,
};
