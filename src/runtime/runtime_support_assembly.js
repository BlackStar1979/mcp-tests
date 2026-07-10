"use strict";

const { createAuditLogger } = require("./audit_log");
const { createDocumentRuntimeContext } = require("./document_runtime_context");
const { createRuntimeRegistryContextFactory } = require("./registry_context_assembly");

function optionalToolsSignature(optionalTools) {
  return optionalTools.map((tool) => `${tool?.name || ""}:${tool?.descriptor?.name || ""}`).join("|");
}

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

  let cachedToolsSignature = "";
  let cachedToolsDescriptors = null;

  function toolsList() {
    const signature = optionalToolsSignature(optionalTools);
    if (!cachedToolsDescriptors || cachedToolsSignature !== signature) {
      cachedToolsDescriptors = Object.freeze(registryContext({ label: "runtime-tools-list" }).descriptors().slice());
      cachedToolsSignature = signature;
    }
    return cachedToolsDescriptors.slice();
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
