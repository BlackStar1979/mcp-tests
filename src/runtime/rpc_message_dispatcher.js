"use strict";

const { handleInitializeMessage } = require("./initialize_message_handler");
const { handleToolsListMessage } = require("./tools_list_message_handler");
const { handleResourcesListMessage } = require("./resources_list_message_handler");
const { handleResourceTemplatesListMessage } = require("./resource_templates_list_message_handler");
const { handlePromptsListMessage } = require("./prompts_list_message_handler");
const { handlePingMessage } = require("./ping_message_handler");
const { handleServerDiscoverMessage } = require("./server_discover_message_handler");
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
  serverStartId,
  disableLegacyInitialize,
}) {
  const { id, method, params } = prelude;

  switch (method) {
    case "initialize": {
      if (disableLegacyInitialize === true) {
        return buildMethodNotFoundResponse(id, method);
      }
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
        serverStartId,
        auditLog,
        requestId: context.requestId,
        sessionId: context.sessionId,
      });
    }

    case "ping": {
      return handlePingMessage(id);
    }

    case "server/discover": {
      return handleServerDiscoverMessage({
        id,
        protocolVersion: context.requestMetadata?.protocolVersion,
        requestMetadata: context.requestMetadata,
        serverName,
        serverVersion,
        connectorShapeVersion,
        outputMode,
        authMode,
        profile,
        tools,
        serverStartId,
        disableLegacyInitialize,
        auditLog,
        requestId: context.requestId,
        sessionId: context.sessionId,
      });
    }

    case "tools/list": {
      return handleToolsListMessage(id, tools, { authMode, auditLog, requestId: context.requestId, sessionId: context.sessionId, serverStartId });
    }

    case "resources/list": {
      return handleResourcesListMessage(id, { authMode, auditLog, requestId: context.requestId, sessionId: context.sessionId });
    }

    case "resources/templates/list": {
      return handleResourceTemplatesListMessage(id, { authMode, auditLog, requestId: context.requestId, sessionId: context.sessionId });
    }

    case "prompts/list": {
      return handlePromptsListMessage(id, { authMode, auditLog, requestId: context.requestId, sessionId: context.sessionId });
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
