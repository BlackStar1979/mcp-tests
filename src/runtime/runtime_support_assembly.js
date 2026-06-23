"use strict";

const { createAuditLogger } = require("./audit_log");
const { createDocumentRuntimeContext } = require("./document_runtime_context");
const { createRuntimeRegistryContextFactory } = require("./registry_context_assembly");

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
  rootDir,
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

  const registryContext = createRuntimeRegistryContextFactory({
    connectorShapeVersion,
    outputMode,
    maxFetchTextChars,
    optionalTools,
    rootDir,
    metadata: { source: "runtime_support_assembly" },
  });

  function toolsList() {
    return registryContext({ label: "runtime-tools-list" }).descriptors();
  }

  return {
    auditLog,
    documentRuntimeContext,
    registryContext,
    toolsList,
  };
}

module.exports = {
  createRuntimeSupportAssembly,
};
