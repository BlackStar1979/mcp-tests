"use strict";

const { createTestMcpRuntimeStatusTool } = require("../../tools/authorized/test_mcp_runtime_status");
const { createObservabilityStatusTool } = require("../../tools/authorized/observability_status");
const { loadOptionalTools } = require("../tool_loader");
const { createOptionalToolLookup } = require("./optional_tools");

function configureOptionalToolsAssembly({
  optionalTools,
  profile,
  authPolicy,
  serverProfileConfig,
  runtimeStatusProvider,
  auditLogPath,
}) {
  optionalTools.push(
    ...loadOptionalTools({
      profile,
      authPolicy,
      serverProfileConfig,
      createRuntimeStatusTool: () => createTestMcpRuntimeStatusTool(runtimeStatusProvider),
      createObservabilityStatusTool: () => createObservabilityStatusTool({ runtimeStatusProvider, auditLogPath }),
    })
  );

  return {
    getOptionalTool: createOptionalToolLookup(optionalTools),
    optionalTools,
  };
}

module.exports = {
  configureOptionalToolsAssembly,
};
