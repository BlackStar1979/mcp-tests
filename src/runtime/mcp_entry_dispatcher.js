"use strict";

const { handleCorsPreflight } = require("./cors_preflight_handler");
const { handleMethodNotAllowed } = require("./method_not_allowed_handler");
const { handleAuthRejection } = require("./auth_rejection_handler");
const { parseRpcRequestBodyOrHandleError } = require("./request_body_parse_handler");
const { handleBatchPayloadIfNeeded } = require("./batch_payload_dispatcher");
const { handleSinglePayload } = require("./single_payload_dispatcher");
const { handleRpcHandlerException } = require("./rpc_handler_exception_handler");
const { jsonResponse } = require("./http_responses");
const { rpcError } = require("./rpc_responses");
const { evaluateGetAccept, evaluatePostAccept } = require("./accept_policy");
const { evaluateProtocolVersionHeader, negotiateInitializeProtocolVersion } = require("./protocol_version_policy");
const { createRequestAbortSignal } = require("./request_cancellation");

async function dispatchMcpEntry({
  req,
  res,
  requestId,
  authPolicy,
  auditLog,
  handleRpcMessage,
  publicBaseUrl,
}) {
  if (req.method === "OPTIONS") {
    handleCorsPreflight({
      req,
      res,
      auditLog,
      requestId,
      sessionId: undefined,
      httpMethod: req.method,
      authPolicy,
      publicBaseUrl,
    });
    return;
  }

  if (req.method === "GET") {
    const getAccept = evaluateGetAccept(req);
    auditLog("streamable_http_preflight", { request_id: requestId, http_method: req.method, accept_ok: getAccept.ok, reason: getAccept.reason || null });
    handleMethodNotAllowed({ res, auditLog, requestId, sessionId: undefined, httpMethod: req.method });
    return;
  }

  if (req.method !== "POST") {
    handleMethodNotAllowed({
      res,
      auditLog,
      requestId,
      sessionId: undefined,
      httpMethod: req.method,
    });
    return;
  }

  const abortSignal = createRequestAbortSignal({ req, auditLog, requestId });

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
      sessionId: undefined,
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
  const protocolVersionHeader = req.headers?.["mcp-protocol-version"];
  const isInitialize = !Array.isArray(payload) && payload && payload.method === "initialize";
  const effectiveProtocolVersion = isInitialize
    ? negotiateInitializeProtocolVersion(payload.params?.protocolVersion).protocolVersion
    : protocolVersion.protocolVersion;

  try {
    const batchHandled = await handleBatchPayloadIfNeeded({
      payload,
      raw,
      res,
      auditLog,
      requestId,
      sessionId: undefined,
      session: null,
      protocolVersion: effectiveProtocolVersion,
      protocolVersionHeader,
      responseMode: "json",
      httpMethod: req.method,
      abortSignal,
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
      sessionId: undefined,
      session: null,
      protocolVersion: effectiveProtocolVersion,
      protocolVersionHeader,
      responseMode: "json",
      httpMethod: req.method,
      abortSignal,
      handleRpcMessage,
    });
  } catch (error) {
    handleRpcHandlerException({
      res,
      auditLog,
      requestId,
      payload,
      error,
      abortSignal,
    });
  }
}

module.exports = {
  dispatchMcpEntry,
};
