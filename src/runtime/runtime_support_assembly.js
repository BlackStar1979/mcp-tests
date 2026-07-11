"use strict";

const { assertToolSchemas, buildToolSurfaceFingerprint } = require("../schema_compat");
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
  let cachedToolIntrospection = null;

  function toolsList() {
    const signature = optionalToolsSignature(optionalTools);
    if (!cachedToolsDescriptors || cachedToolsSignature !== signature) {
      cachedToolsDescriptors = Object.freeze(registryContext({ label: "runtime-tools-list" }).descriptors().slice());
      cachedToolsSignature = signature;
      cachedToolIntrospection = null;
    }
    return cachedToolsDescriptors.slice();
  }

  function toolIntrospection() {
    const tools = toolsList();
    if (!cachedToolIntrospection) {
      cachedToolIntrospection = {
        tools,
        toolSurface: buildToolSurfaceFingerprint(tools),
        schemaCompatibility: assertToolSchemas(tools),
      };
    }
    return {
      tools: cachedToolIntrospection.tools.slice(),
      toolSurface: cachedToolIntrospection.toolSurface,
      schemaCompatibility: cachedToolIntrospection.schemaCompatibility,
    };
  }

  return {
    auditLog,
    documentRuntimeContext,
    registryContext,
    toolIntrospection,
    toolsList,
  };
}

module.exports = {
  createRuntimeSupportAssembly,
};
