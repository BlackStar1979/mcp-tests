"use strict";

const http = require("node:http");
const { URL } = require("node:url");
const { corsHeadersForRequest } = require("./cors_policy");

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
}) {
  return http.createServer(async (req, res) => {
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
    });
  });
}

module.exports = { createServer };
