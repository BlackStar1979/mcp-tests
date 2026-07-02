"use strict";

const { dispatchMcpEntry } = require("./mcp_entry_dispatcher");
const { createRequestIdGenerator } = require("./request_id");
const { buildRpcMessagePrelude } = require("./rpc_message_prelude");
const { rpcError } = require("./rpc_responses");
const { validateRpcMessage } = require("./rpc_protocol_validator");
const { shouldReturnNoRpcResponse } = require("./rpc_no_response");
const { dispatchRpcMessage } = require("./rpc_message_dispatcher");
const { createSessionReplayTracker } = require("./session_tracker");
const { enrichContextWithSampling } = require("./sampling_context");
const { validatePerRequestMetadata } = require("./request_metadata_policy");

function createMcpRuntimeHandlers({
  serverName,
  serverVersion,
  connectorShapeVersion,
  outputMode,
  authPolicy,
  runtimeProfile,
  toolsList,
  documentRuntimeContext,
  auditLog,
  getOptionalTool,
  publicBaseUrl,
  rateLimiter,
  serverStartId,
}) {
  const nextRequestId = createRequestIdGenerator();
  const replayTracker = createSessionReplayTracker();

  async function handleRpcMessage(message, context = {}) {
    const validation = validateRpcMessage(message);

    if (!validation.ok) {
      auditLog("rpc_protocol_error", {
        request_id: context.requestId,
        reason: validation.reason,
      });
      return rpcError(validation.id, validation.code, validation.message, {
        reason: validation.reason,
      });
    }

    const prelude = buildRpcMessagePrelude(validation);

    const replay = replayTracker.remember({ sessionId: context.sessionId, rpcId: prelude.id });
    if (!replay.ok) {
      auditLog("rpc_protocol_error", { request_id: context.requestId, session_id: context.sessionId || "default", reason: replay.reason });
      return rpcError(prelude.id, -32600, "Invalid Request", { reason: replay.reason });
    }

    if (shouldReturnNoRpcResponse(prelude.id, prelude.method)) {
      return undefined;
    }

    const enrichedContext = enrichContextWithSampling(context, auditLog);
    if (prelude.method === "server/discover") {
      const requestMetadata = validatePerRequestMetadata({
        protocolVersionHeader: context.protocolVersionHeader,
        message,
      });
      if (!requestMetadata.ok) {
        auditLog("rpc_protocol_error", {
          request_id: context.requestId,
          session_id: context.sessionId || "",
          reason: requestMetadata.reason,
          method: prelude.method,
        });
        return requestMetadata.response;
      }
      enrichedContext.requestMetadata = requestMetadata;
    }

    return dispatchRpcMessage({
      prelude,
      context: enrichedContext,
      serverName,
      serverVersion,
      connectorShapeVersion,
      outputMode,
      authMode: authPolicy.mode,
      profile: runtimeProfile,
      tools: toolsList(),
      documentRuntimeContext,
      auditLog,
      getOptionalTool,
      rateLimiter,
      serverStartId,
    });
  }

  async function handleMcp(req, res) {
    const requestId = nextRequestId();

    await dispatchMcpEntry({
      req,
      res,
      requestId,
      authPolicy,
      auditLog,
      handleRpcMessage,
      publicBaseUrl,
    });
  }

  return {
    handleMcp,
    handleRpcMessage,
  };
}

module.exports = {
  createMcpRuntimeHandlers,
};
