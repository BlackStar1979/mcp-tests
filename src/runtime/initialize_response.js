"use strict";

const { assertToolSchemas, buildToolSurfaceFingerprint } = require("../schema_compat");
const { negotiateInitializeProtocolVersion } = require("./protocol_version_policy");

function buildInitializeResponse({
  protocolVersion,
  serverName,
  serverVersion,
  connectorShapeVersion,
  outputMode,
  authMode,
  profile,
  tools,
  toolIntrospection,
  serverStartId,
}) {
  const negotiated = negotiateInitializeProtocolVersion(protocolVersion);
  const introspection = toolIntrospection && typeof toolIntrospection === "object"
    ? toolIntrospection
    : null;
  const sourceTools = Array.isArray(introspection?.tools) ? introspection.tools : tools;
  const enabledTools = Array.isArray(introspection?.toolNames)
    ? introspection.toolNames.slice()
    : sourceTools.map((tool) => tool.name);
  return {
    protocolVersion: negotiated.protocolVersion,
    capabilities: {
      tools: {
        listChanged: false,
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
      enabledTools,
      toolSurface: introspection?.toolSurface || buildToolSurfaceFingerprint(sourceTools),
      schemaCompatibility: introspection?.schemaCompatibility || assertToolSchemas(sourceTools),
    },
    instructions:
      `TEST MCP workbench server for connector compatibility, bounded code sampling, and controlled network tools. ` +
      `Connector shape ${connectorShapeVersion}. ` +
      `Output mode ${outputMode}. Exposes the active profile tool surface reported in serverInfo.enabledTools.`,
  };
}

module.exports = {
  buildInitializeResponse,
};
