"use strict";

const { handleCorsPreflight } = require("./cors_preflight_handler");
const { handleMethodNotAllowed } = require("./method_not_allowed_handler");
const { handleAuthRejection } = require("./auth_rejection_handler");
const { parseRpcRequestBodyOrHandleError } = require("./request_body_parse_handler");
const { handleBatchPayloadIfNeeded } = require("./batch_payload_dispatcher");
const { handleSinglePayload } = require("./single_payload_dispatcher");
const { handleMcpGetStream } = require("./mcp_get_stream_handler");
const { handleRpcHandlerException } = require("./rpc_handler_exception_handler");
const { getRequestSessionId } = require("./session_tracker");
const { jsonResponse } = require("./http_responses");
const { rpcError } = require("./rpc_responses");
const { evaluateGetAccept, evaluatePostAccept } = require("./accept_policy");
const { evaluateProtocolVersionHeader, negotiateInitializeProtocolVersion } = require("./protocol_version_policy");

async function dispatchMcpEntry({
  req,
  res,
  requestId,
  authPolicy,
  auditLog,
  handleRpcMessage,
  publicBaseUrl,
  sessionStore,
}) {
  const sessionId = getRequestSessionId(req);
  if (sessionId === null) {
    auditLog("rpc_protocol_error", { request_id: requestId, reason: "invalid_session_id" });
    jsonResponse(res, 400, rpcError(null, -32600, "Invalid Request", { reason: "invalid_session_id" }));
    return;
  }

  if (req.method === "OPTIONS") {
    handleCorsPreflight({
      req,
      res,
      auditLog,
      requestId,
      sessionId,
      httpMethod: req.method,
      authPolicy,
      publicBaseUrl,
    });
    return;
  }

  if (req.method === "GET") {
    const getAccept = evaluateGetAccept(req);
    auditLog("streamable_http_preflight", { request_id: requestId, http_method: req.method, accept_ok: getAccept.ok, reason: getAccept.reason || null });
    if (!getAccept.ok) {
      handleMethodNotAllowed({ res, auditLog, requestId, sessionId, httpMethod: req.method });
      return;
    }
    const authResult = authPolicy.authenticate(req);
    if (!authResult.ok) {
      handleAuthRejection({ res, auditLog, requestId, sessionId, httpMethod: req.method, authResult, authPolicy });
      return;
    }
    handleMcpGetStream({ req, res, requestId, sessionId, sessionStore, auditLog });
    return;
  }

  if (req.method !== "POST") {
    handleMethodNotAllowed({
      res,
      auditLog,
      requestId,
      sessionId,
      httpMethod: req.method,
    });
    return;
  }

  const postAccept = evaluatePostAccept(req);
  if (!postAccept.ok) {
    auditLog("streamable_http_preflight", { request_id: requestId, http_method: req.method, accept_ok: false, reason: postAccept.reason });
    jsonResponse(res, 406, rpcError(null, -32600, "Invalid Request", { reason: postAccept.reason }));
    return;
  }

  const protocolVersion = evaluateProtocolVersionHeader(req);
  if (!protocolVersion.ok) {
    auditLog("streamable_http_preflight", { request_id: requestId, http_method: req.method, protocol_version_ok: false, reason: protocolVersion.reason });
    jsonResponse(res, 400, rpcError(null, -32600, "Invalid Request", { reason: protocolVersion.reason }));
    return;
  }

  const authResult = authPolicy.authenticate(req);

  if (!authResult.ok) {
    handleAuthRejection({
      res,
      auditLog,
      requestId,
      sessionId,
      httpMethod: req.method,
      authResult,
      authPolicy,
    });
    return;
  }

  const parsedRequest = await parseRpcRequestBodyOrHandleError({
    req,
    res,
    auditLog,
    requestId,
    httpMethod: req.method,
  });

  if (!parsedRequest.ok) {
    return;
  }

  const { payload, raw } = parsedRequest;

  let activeSession = null;
  if (sessionId !== undefined) {
    activeSession = sessionStore ? sessionStore.get(sessionId) : null;
    if (!activeSession) {
      jsonResponse(res, 404, rpcError(null, -32000, "Unknown session", { reason: "unknown_session" }));
      return;
    }
  }

  if (!Array.isArray(payload) && payload && payload.method === "initialize" && sessionStore && sessionId === undefined) {
    const negotiated = negotiateInitializeProtocolVersion(payload.params?.protocolVersion);
    activeSession = sessionStore.create({
      protocolVersion: negotiated.protocolVersion,
      clientCapabilities: payload.params?.capabilities || {},
    });
    res.setHeader("Mcp-Session-Id", activeSession.id);
    auditLog("session_created", { request_id: requestId, session: activeSession.toAuditSummary() });
  }

  try {
    const batchHandled = await handleBatchPayloadIfNeeded({
      payload,
      raw,
      res,
      auditLog,
      requestId,
      sessionId: activeSession?.id || sessionId,
      session: activeSession,
      protocolVersion: activeSession?.protocolVersion || protocolVersion.protocolVersion,
      responseMode: postAccept.mediaTypes.includes("text/event-stream") ? "sse" : "json",
      httpMethod: req.method,
      handleRpcMessage,
    });

    if (batchHandled) {
      return;
    }

    await handleSinglePayload({
      payload,
      raw,
      res,
      auditLog,
      requestId,
      sessionId: activeSession?.id || sessionId,
      session: activeSession,
      protocolVersion: activeSession?.protocolVersion || protocolVersion.protocolVersion,
      responseMode: postAccept.mediaTypes.includes("text/event-stream") ? "sse" : "json",
      httpMethod: req.method,
      handleRpcMessage,
    });
  } catch (error) {
    handleRpcHandlerException({
      res,
      auditLog,
      requestId,
      payload,
      error,
    });
  }
}

module.exports = {
  dispatchMcpEntry,
};
