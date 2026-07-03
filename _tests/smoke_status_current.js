const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createTestMcpRuntimeStatusTool } = require("../tools/test_mcp_runtime_status");
const { CURRENT_STAGE_STATUS, CURRENT_COMPATIBILITY_LABEL } = require("../src/stage_metadata");

const serverSource = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.resolve(__dirname, "..", "src", "runtime", "server_bootstrap_runtime.js"), "utf8");
const stageMetadataSource = fs.readFileSync(path.resolve(__dirname, "..", "src", "stage_metadata.js"), "utf8");
assert.match(stageMetadataSource, /const CURRENT_STAGE_STATUS = "stage8_20-runtime-status-compact-mode";/);
assert.match(bootstrapSource, /const stageStatus = CURRENT_STAGE_STATUS;/);
assert.doesNotMatch(serverSource, /stage8_11-observability-stream-connector-diagnostics/);
assert.doesNotMatch(bootstrapSource, /stage8_11-observability-stream-connector-diagnostics/);
assert.doesNotMatch(serverSource, /const STAGE_STATUS = "stage8_20-runtime-status-compact-mode";/);
assert.doesNotMatch(bootstrapSource, /const stageStatus = "stage8_20-runtime-status-compact-mode";/);

const tool = createTestMcpRuntimeStatusTool(() => ({
  compatibility_label: CURRENT_COMPATIBILITY_LABEL,
  stage_status: CURRENT_STAGE_STATUS,
  request_contract: {
    route: "/mcp",
    post_only: true,
    initialize_required: false,
    protocol_sessions: false,
    server_discover_supported: true,
    legacy_initialize_supported: true,
    transport_mode: "streamable_http_stateless_legacy_initialize_compat",
  },
  enabled_tools: ["a"],
  tool_policy_summary: [{ tool: "a" }],
  tool_surface: { tool_count: 40, tool_names: ["a"], tool_names_hash: "abc123abc123", per_tool: [{ tool: "a" }] },
  schema_compatibility: { success: true, per_tool: [{ tool: "a" }], issues: [] },
}));

(async () => {
  const status = await tool.execute({ include_tools: false });
  assert.equal(status.compatibility_label, CURRENT_COMPATIBILITY_LABEL);
  assert.equal(status.stage_status, CURRENT_STAGE_STATUS);
  assert.equal(status.request_contract.route, "/mcp");
  assert.equal(status.request_contract.server_discover_supported, true);
  assert.equal(status.request_contract.legacy_initialize_supported, true);
  assert.deepEqual(status.enabled_tools, []);
  assert.deepEqual(status.tool_policy_summary, []);
  assert.equal(status.tool_surface.tool_count, 40);
  assert.equal(Object.prototype.hasOwnProperty.call(status.tool_surface, "tool_names"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(status.tool_surface, "per_tool"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(status.schema_compatibility, "per_tool"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(status.schema_compatibility, "issues"), false);
  console.log("smoke_status_current ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
