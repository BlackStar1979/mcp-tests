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
  serverStartId,
}) {
  const negotiated = negotiateInitializeProtocolVersion(protocolVersion);
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
      enabledTools: tools.map((tool) => tool.name),
      toolSurface: buildToolSurfaceFingerprint(tools),
      schemaCompatibility: assertToolSchemas(tools),
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
