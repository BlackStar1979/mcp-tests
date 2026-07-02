"use strict";

const http = require("node:http");
const { URL } = require("node:url");
const { corsHeadersForRequest } = require("./cors_policy");
const { isAllowedHost, rejectInvalidHost } = require("./host_header_guard");

function createServer({
  host,
  port,
  dispatchCreateServerRoute,
  handleMcp,
  handleHealthRoute,
  handleDocsRoute,
  handleNotFoundRoute,
  jsonResponse,
  textResponse,
  fetchDoc,
  documentRuntimeContext,
  serverName,
  serverVersion,
  connectorShapeVersion,
  outputMode,
  maxFetchTextChars,
  auditVersion,
  authPolicy,
  runtimeProfile,
  stageStatus,
  securityBoundary,
  publicBaseUrl,
  toolsList,
  authorizationServerMetadataProvider,
  oauth21AuthorizationServer,
  auditLog,
}) {
  return http.createServer(async (req, res) => {
    try {
      if (!isAllowedHost(req, { publicBaseUrl })) {
      return rejectInvalidHost(res);
      }
      const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);

      for (const [key, value] of Object.entries(corsHeadersForRequest(req, { authPolicy, publicBaseUrl }))) {
      res.setHeader(key, value);
      }

      await dispatchCreateServerRoute({
      req,
      res,
      url,
      handleMcp,
      handleHealthRoute,
      handleDocsRoute,
      handleNotFoundRoute,
      jsonResponse,
      textResponse,
      fetchDoc,
      documentRuntimeContext,
      serverName,
      serverVersion,
      connectorShapeVersion,
      outputMode,
      maxFetchTextChars,
      auditVersion,
      authPolicy,
      runtimeProfile,
      stageStatus,
      securityBoundary,
      publicBaseUrl,
      toolsList,
      authorizationServerMetadataProvider,
      oauth21AuthorizationServer,
      auditLog,
      });
    } catch (error) {
      if (!res.headersSent) {
        const statusCode = Number(error && error.statusCode) || 500;
        const body = statusCode === 400 ? { error: "invalid_request" } : { error: "server_error" };
        return jsonResponse(res, statusCode, body);
      }
      res.destroy(error);
    }
  });
}

module.exports = { createServer };
