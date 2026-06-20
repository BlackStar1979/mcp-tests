const assert = require("node:assert/strict");
const MCP_URL = process.env.MCP_TEST_SMOKE_URL || "http://127.0.0.1:3009/mcp";

async function rpc(method, params = {}) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  assert.equal(response.status, 200, method + " HTTP status");
  return response.json();
}

(async () => {
  const listed = await rpc("tools/list", {});
  const tools = listed.result?.tools || [];
  const toolNames = tools.map((tool) => tool.name);
  assert.equal(toolNames.includes("test_mcp_runtime_status"), false);
  assert.equal(toolNames.includes("observability_status"), false);
  assert.equal(toolNames.some((name) => name.startsWith("memory_")), false);
  assert.ok(toolNames.includes("search"));
  assert.ok(toolNames.includes("fetch"));

  console.log(JSON.stringify({ ok: true, profile: "public", auth: "none", count: toolNames.length }, null, 2));
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
