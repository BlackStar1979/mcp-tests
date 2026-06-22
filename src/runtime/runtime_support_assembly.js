"use strict";

const { buildCoreToolDescriptors } = require("./core_tool_descriptors");
const { createStaticToolRegistry } = require("../static_tool_registry");
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

    return createStaticToolRegistry({
      coreDescriptors: baseTools,
      optionalTools,
      metadata: { source: "runtime_support_assembly" },
    }).descriptors();
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
