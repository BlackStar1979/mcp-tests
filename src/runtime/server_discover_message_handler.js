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
} = {}) {
  const sourceTools = Array.isArray(tools) ? tools : [];
  const toolSurface = buildToolSurfaceFingerprint(sourceTools);
  const resolvedProtocolVersion = typeof protocolVersion === "string" && protocolVersion
    ? protocolVersion
    : SUPPORTED_PER_REQUEST_PROTOCOL_VERSIONS[0];

  return rpcResult(id, {
    supportedVersions: [...SUPPORTED_PER_REQUEST_PROTOCOL_VERSIONS],
    capabilities: {
      tools: {
        listChanged: false,
      },
      experimental: {
        singleRouteNoSseTarget: true,
        legacyInitializeAlsoSupported: true,
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
      mode: "streamable_http_hybrid_transition",
      route: "/mcp",
      post_only: true,
      protocol_sessions: true,
      initialize_required: false,
      legacy_initialize_supported: true,
    },
  });
}

module.exports = {
  handleServerDiscoverMessage,
};
