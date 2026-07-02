"use strict";

const { assertToolSchemas, buildToolSurfaceFingerprint } = require("../schema_compat");
const { rpcResult } = require("./rpc_responses");
const { SUPPORTED_PER_REQUEST_PROTOCOL_VERSIONS } = require("./request_metadata_policy");

function handleServerDiscoverMessage({
  id,
  protocolVersion,
  serverName,
  serverVersion,
  connectorShapeVersion,
  outputMode,
  authMode,
  profile,
  tools,
  serverStartId,
  disableLegacyInitialize,
} = {}) {
  const sourceTools = Array.isArray(tools) ? tools : [];
  const toolSurface = buildToolSurfaceFingerprint(sourceTools);
  const resolvedProtocolVersion = typeof protocolVersion === "string" && protocolVersion
    ? protocolVersion
    : SUPPORTED_PER_REQUEST_PROTOCOL_VERSIONS[0];

  const legacyInitializeSupported = disableLegacyInitialize !== true;

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
      schemaCompatibility: assertToolSchemas(sourceTools),
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
