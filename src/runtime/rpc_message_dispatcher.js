"use strict";

const { handleInitializeMessage } = require("./initialize_message_handler");
const { handleToolsListMessage } = require("./tools_list_message_handler");
const { handlePingMessage } = require("./ping_message_handler");
const { handleToolsCall } = require("./tools_call_handler");
const { buildMethodNotFoundResponse } = require("./method_not_found_response");

async function dispatchRpcMessage({
  prelude,
  context = {},
  serverName,
  serverVersion,
  connectorShapeVersion,
  outputMode,
  authMode,
  profile,
  tools,
  documentRuntimeContext,
  auditLog,
  getOptionalTool,
  rateLimiter,
}) {
  const { id, method, params } = prelude;

  switch (method) {
    case "initialize": {
      return handleInitializeMessage({
        id,
        params,
        serverName,
        serverVersion,
        connectorShapeVersion,
        outputMode,
        authMode,
        profile,
        tools,
      });
    }

    case "ping": {
      return handlePingMessage(id);
    }

    case "tools/list": {
      return handleToolsListMessage(id, tools, { authMode });
    }

    case "tools/call": {
      return handleToolsCall({
        id,
        params,
        context,
        outputMode,
        documentRuntimeContext,
        auditLog,
        authMode,
        profile,
        getOptionalTool,
        rateLimiter,
      });
    }

    default: {
      return buildMethodNotFoundResponse(id, method);
    }
  }
}

module.exports = {
  dispatchRpcMessage,
};
