"use strict";

const { dispatchMcpEntry } = require("./mcp_entry_dispatcher");
const { createRequestIdGenerator } = require("./request_id");
const { buildRpcMessagePrelude } = require("./rpc_message_prelude");
const { rpcError } = require("./rpc_responses");
const { validateRpcMessage } = require("./rpc_protocol_validator");
const { shouldReturnNoRpcResponse } = require("./rpc_no_response");
const { dispatchRpcMessage } = require("./rpc_message_dispatcher");
const { createSessionReplayTracker } = require("./session_tracker");
const { validateModernHttpHeaders, validatePerRequestMetadata } = require("./request_metadata_policy");
const { isModernProtocolVersion } = require("./protocol_version_policy");
const { decorateModernRpcResponse } = require("./modern_protocol_adapter");
const { traceAuditFields } = require("./trace_context");
const { createMrtrExtension } = require("./mrtr_extension");

function createMcpRuntimeHandlers({
  serverName,
  serverVersion,
  connectorShapeVersion,
  outputMode,
  authPolicy,
  runtimeProfile,
  toolIntrospection,
  toolsList,
  documentRuntimeContext,
  auditLog,
  getOptionalTool,
  publicBaseUrl,
  rateLimiter,
  serverStartId,
  disableLegacyInitialize,
  mrtrExtension,
}) {
  const nextRequestId = createRequestIdGenerator();
  const replayTracker = createSessionReplayTracker();
  const activeMrtrExtension = mrtrExtension || createMrtrExtension();

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

    const enrichedContext = { ...context };
    const modernRequest = isModernProtocolVersion(context.protocolVersion);
    if (modernRequest || prelude.method === "server/discover") {
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
      enrichedContext.traceContext = requestMetadata.traceContext;
      auditLog("trace_context_resolved", {
        request_id: context.requestId, method: prelude.method, ...traceAuditFields(requestMetadata.traceContext),
      });
    }

    if (modernRequest) {
      const standardHeaders = validateModernHttpHeaders({ headers: context.requestHeaders, message });
      if (!standardHeaders.ok) {
        auditLog("rpc_protocol_error", {
          request_id: context.requestId,
          session_id: context.sessionId || "",
          reason: standardHeaders.reason,
          method: prelude.method,
        });
        return standardHeaders.response;
      }
    }

    if (shouldReturnNoRpcResponse(prelude.id, prelude.method)) {
      return undefined;
    }

    const response = await dispatchRpcMessage({
      prelude,
      context: enrichedContext,
      serverName,
      serverVersion,
      connectorShapeVersion,
      outputMode,
      authMode: authPolicy.mode,
      profile: runtimeProfile,
      toolIntrospection,
      toolsList,
      documentRuntimeContext,
      auditLog,
      getOptionalTool,
      rateLimiter,
      mrtrExtension: activeMrtrExtension,
      serverStartId,
      disableLegacyInitialize,
    });
    return decorateModernRpcResponse(response, {
      protocolVersion: context.protocolVersion,
      serverInfo: { name: serverName, version: serverVersion },
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
