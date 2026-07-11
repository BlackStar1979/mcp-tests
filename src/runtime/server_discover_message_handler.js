"use strict";

const { assertToolSchemas, buildToolSurfaceFingerprint } = require("../schema_compat");
const { rpcResult } = require("./rpc_responses");
const { SUPPORTED_PER_REQUEST_PROTOCOL_VERSIONS } = require("./request_metadata_policy");

function handleServerDiscoverMessage({
  id,
  protocolVersion,
  requestMetadata,
  serverName,
  serverVersion,
  connectorShapeVersion,
  outputMode,
  authMode,
  profile,
  tools,
  toolIntrospection,
  serverStartId,
  disableLegacyInitialize,
  auditLog,
  requestId,
  sessionId,
} = {}) {
  const introspection = toolIntrospection && typeof toolIntrospection === "object"
    ? toolIntrospection
    : null;
  const sourceTools = Array.isArray(introspection?.tools)
    ? introspection.tools
    : Array.isArray(tools) ? tools : [];
  const toolSurface = introspection?.toolSurface || buildToolSurfaceFingerprint(sourceTools);
  const resolvedProtocolVersion = typeof protocolVersion === "string" && protocolVersion
    ? protocolVersion
    : SUPPORTED_PER_REQUEST_PROTOCOL_VERSIONS[0];

  const legacyInitializeSupported = disableLegacyInitialize !== true;

  if (typeof auditLog === "function") {
    auditLog("server_discover_received", {
      request_id: requestId,
      session_id: sessionId || "",
      protocol_version: resolvedProtocolVersion,
      client_name: requestMetadata?.clientInfo?.name || "",
      client_version: requestMetadata?.clientInfo?.version || "",
      has_client_capabilities: Boolean(requestMetadata?.clientCapabilities),
      auth_mode: authMode,
      profile,
      server_start_id: typeof serverStartId === "string" ? serverStartId : "",
    });
  }

  return rpcResult(id, {
    supportedVersions: [...SUPPORTED_PER_REQUEST_PROTOCOL_VERSIONS],
    capabilities: {
      tools: {
        listChanged: false,
      },
      experimental: {
        singleRouteNoSseTarget: true,
        legacyInitializeAlsoSupported: legacyInitializeSupported,
      },
    },
    serverInfo: {
      name: serverName,
      version: serverVersion,
      connectorShapeVersion,
      outputMode,
      authMode,
      profile,
      serverStartId: typeof serverStartId === "string" ? serverStartId : "",
      enabledTools: sourceTools.map((tool) => tool.name),
      toolSurface,
      schemaCompatibility: introspection?.schemaCompatibility || assertToolSchemas(sourceTools),
    },
    server: {
      name: serverName,
      version: serverVersion,
      connectorShapeVersion,
    },
    protocolVersion: resolvedProtocolVersion,
    transport: {
      mode: legacyInitializeSupported
        ? "streamable_http_stateless_legacy_initialize_compat"
        : "streamable_http_stateless_no_initialize",
      route: "/mcp",
      post_only: true,
      protocol_sessions: false,
      initialize_required: false,
      legacy_initialize_supported: legacyInitializeSupported,
    },
  });
}

module.exports = {
  handleServerDiscoverMessage,
};
