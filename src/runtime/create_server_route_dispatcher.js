"use strict";

async function dispatchCreateServerRoute({
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
  sessionlessPrototypeRouteHandler,
}) {
  if (oauth21AuthorizationServer) {
    const handled = await oauth21AuthorizationServer.handleRoute({ req, res, url });
    if (handled !== false) return handled;
  }
  if (url.pathname === "/mcp/sessionless" && sessionlessPrototypeRouteHandler) {
    const handled = await sessionlessPrototypeRouteHandler.handleRoute({ req, res, url });
    if (handled !== false) return handled;
  }

  if (url.pathname === "/.well-known/oauth-protected-resource") {
    const { buildProtectedResourceMetadata } = require("./oauth_metadata");
    let authorizationServerMetadata;
    if (authorizationServerMetadataProvider) {
      authorizationServerMetadata = authorizationServerMetadataProvider.get();
    }
    return jsonResponse(res, 200, buildProtectedResourceMetadata({ publicBaseUrl, authorizationServerMetadata }));
  }
  if (url.pathname === "/" || url.pathname === "/healthz") {
    handleHealthRoute({
      res,
      jsonResponse,
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
    });
    return;
  }

  if (url.pathname.startsWith("/docs/")) {
    return handleDocsRoute({
      res,
      pathname: url.pathname,
      textResponse,
      fetchDoc,
      documentRuntimeContext,
    });
  }

  if (url.pathname === "/mcp") {
    await handleMcp(req, res);
    return;
  }

  return handleNotFoundRoute({
    res,
    jsonResponse,
  });
}

module.exports = {
  dispatchCreateServerRoute,
};
