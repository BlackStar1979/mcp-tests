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
}) {
  return rpcResult(id, buildInitializeResponse({
    protocolVersion: params.protocolVersion,
    serverName,
    serverVersion,
    connectorShapeVersion,
    outputMode,
    authMode,
    profile,
    tools,
  }));
}

module.exports = {
  handleInitializeMessage,
};
