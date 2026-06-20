const assert = require("node:assert/strict");

const { buildInitializeResponse } = require("../src/runtime/initialize_response");
const { buildCoreToolDescriptors } = require("../src/runtime/core_tool_descriptors");
const { loadOptionalTools } = require("../src/tool_loader");
const { createTestMcpRuntimeStatusTool } = require("../tools/authorized/test_mcp_runtime_status");
const { createObservabilityStatusTool } = require("../tools/authorized/observability_status");
const {
  CONNECTOR_SHAPE_VERSION,
  SERVER_NAME,
  SERVER_VERSION,
} = require("../src/runtime/identity");

function createRuntimeStatusTool() {
  return createTestMcpRuntimeStatusTool(() => ({
    status: "ok",
  }));
}

function createObservabilityTool() {
  return createObservabilityStatusTool({
    auditLogPath: "_logs/.mcp-tests-audit.jsonl",
  });
}

const outputMode = "structured";
const tools = [
  ...buildCoreToolDescriptors({
    connectorShapeVersion: CONNECTOR_SHAPE_VERSION,
    outputMode,
    maxFetchTextChars: 2500,
  }),
  ...loadOptionalTools({
    profile: "public",
    serverProfileConfig: { surface: { optional_tool_groups: ["public"], include_memory_tools: false } },
    createRuntimeStatusTool,
    createObservabilityStatusTool: createObservabilityTool,
  }).map((tool) => tool.descriptor),
];

const response = buildInitializeResponse({
  protocolVersion: "2025-06-18",
  serverName: SERVER_NAME,
  serverVersion: SERVER_VERSION,
  connectorShapeVersion: CONNECTOR_SHAPE_VERSION,
  outputMode,
  authMode: "none",
  profile: "public",
  tools,
});

assert.equal(response.protocolVersion, "2025-06-18");
assert.equal(response.capabilities.tools.listChanged, false);
assert.equal(response.serverInfo.name, "mcp-tests-response-shape");
assert.equal(response.serverInfo.version, "0.30.0");
assert.equal(response.serverInfo.connectorShapeVersion, "2025-05-strict-v1");
assert.equal(response.serverInfo.outputMode, "structured");
assert.equal(response.serverInfo.authMode, "none");
assert.equal(response.serverInfo.profile, "public");
assert.equal(response.serverInfo.enabledTools.length, 13);
assert.equal(response.serverInfo.toolSurface.tool_count, 13);
assert.equal(typeof response.serverInfo.toolSurface.tool_names_hash, "string");
assert.equal(typeof response.serverInfo.toolSurface.input_schema_fingerprint, "string");
assert.equal(typeof response.serverInfo.toolSurface.output_schema_fingerprint, "string");
assert.equal(typeof response.serverInfo.toolSurface.descriptor_fingerprint, "string");
assert.equal(typeof response.serverInfo.toolSurface.combined_fingerprint, "string");

console.log("smoke_initialize_server_info_contract ok");
