"use strict";

const { buildCoreToolDescriptors } = require("./core_tool_descriptors");
const { createAuditLogger } = require("./audit_log");
const { createDocumentRuntimeContext } = require("./document_runtime_context");

function createRuntimeSupportAssembly({
  auditLogPath,
  auditVersion,
  serverName,
  serverVersion,
  connectorShapeVersion,
  docs,
  publicBaseUrl,
  maxFetchTextChars,
  outputMode,
  optionalTools,
}) {
  const auditLog = createAuditLogger({
    auditLogPath,
    auditVersion,
    serverName,
    serverVersion,
    connectorShapeVersion,
  });

  const documentRuntimeContext = createDocumentRuntimeContext({
    docs,
    publicBaseUrl,
    maxFetchTextChars,
    connectorShapeVersion,
  });

  function toolsList() {
    const baseTools = buildCoreToolDescriptors({
      connectorShapeVersion,
      outputMode,
      maxFetchTextChars,
    });

    return baseTools.concat(optionalTools.map((tool) => tool.descriptor));
  }

  return {
    auditLog,
    documentRuntimeContext,
    toolsList,
  };
}

module.exports = {
  createRuntimeSupportAssembly,
};
