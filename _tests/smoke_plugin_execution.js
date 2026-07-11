const assert = require("node:assert/strict");

const MCP_URL = process.env.MCP_TEST_SMOKE_URL || "http://127.0.0.1:3009/mcp";

async function callTool(name, args = {}) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `${name}-${Date.now()}`,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  assert.equal(response.status, 200, `${name} HTTP status`);
  return response.json();
}

(async () => {
  const internalRuntimeTools = [
    ["plugin_execution_preflight", { tool_name: "plugin_sample_echo_preview" }],
    ["plugin_execute_readonly", { tool_name: "plugin_sample_echo_preview", text: "hello wrapper" }],
  ];

  for (const [name, args] of internalRuntimeTools) {
    const json = await callTool(name, args);
    assert.equal(json.result, undefined, `${name} must not return result on MCP surface`);
    assert.equal(json.error?.code, -32602, `${name} must be rejected as unknown MCP tool`);
    assert.equal(json.error?.message, `Unknown tool: ${name}`, `${name} unknown-tool message`);
  }

  console.log("smoke_plugin_execution ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
