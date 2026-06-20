const assert = require("node:assert/strict");
const { createTestMcpRuntimeStatusTool } = require("../tools/test_mcp_runtime_status");

const fullStatus = {
  enabled_tools: ["a", "b"],
  tool_policy_summary: [{ tool: "a" }, { tool: "b" }],
  tool_surface: {
    tool_count: 2,
    tool_names: ["a", "b"],
    tool_names_hash: "abc123abc123",
    per_tool: [{ tool: "a" }, { tool: "b" }],
  },
  schema_compatibility: {
    success: true,
    status: "ok",
    tool_count: 2,
    error_count: 0,
    warning_count: 0,
    schema_fingerprint: "def456def456",
    per_tool: [{ tool: "a" }, { tool: "b" }],
    issues: [],
  },
};

let calls = 0;
const tool = createTestMcpRuntimeStatusTool(() => {
  calls += 1;
  return JSON.parse(JSON.stringify(fullStatus));
});

(async () => {
  const compact = await tool.execute({ include_tools: false });
  assert.equal(calls, 1);
  assert.deepEqual(compact.enabled_tools, []);
  assert.deepEqual(compact.tool_policy_summary, []);
  assert.equal(compact.tool_surface.tool_count, 2);
  assert.equal(compact.tool_surface.tool_names_hash, "abc123abc123");
  assert.equal(Object.prototype.hasOwnProperty.call(compact.tool_surface, "tool_names"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(compact.tool_surface, "per_tool"), false);
  assert.equal(compact.schema_compatibility.success, true);
  assert.equal(compact.schema_compatibility.schema_fingerprint, "def456def456");
  assert.equal(Object.prototype.hasOwnProperty.call(compact.schema_compatibility, "per_tool"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(compact.schema_compatibility, "issues"), false);

  const verbose = await tool.execute({ include_tools: true });
  assert.equal(calls, 2);
  assert.deepEqual(verbose.enabled_tools, ["a", "b"]);
  assert.equal(verbose.tool_surface.per_tool.length, 2);
  assert.equal(verbose.schema_compatibility.per_tool.length, 2);

  const defaultPayload = await tool.execute({});
  assert.equal(calls, 3);
  assert.deepEqual(defaultPayload.enabled_tools, ["a", "b"]);

  console.log("smoke_stage8_20_runtime_status_compact ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
