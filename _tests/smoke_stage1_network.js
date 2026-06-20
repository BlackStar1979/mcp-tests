const assert = require("node:assert/strict");

const MCP_URL = process.env.MCP_TEST_SMOKE_URL || "http://127.0.0.1:3009/mcp";

async function callTool(name, args) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });

  assert.equal(response.status, 200, `${name} HTTP status`);
  const json = await response.json();
  assert.ok(json.result, `${name} must return JSON-RPC result`);
  const text = json.result?.content?.[0]?.text || "";
  assert.ok(text, `${name} must return content[0].text`);
  return JSON.parse(text);
}

(async () => {
  const head = await callTool("net_check_url_head", {
    url: "https://modelcontextprotocol.io/",
  });
  assert.equal(head.success, true);
  assert.equal(head.ok, true);
  assert.equal(head.status, 200);

  const spec = await callTool("net_fetch_text_allowlisted", {
    url: "https://modelcontextprotocol.io/specification",
    max_bytes: 12000,
  });
  assert.equal(spec.success, true);
  assert.equal(spec.ok, true);
  assert.equal(spec.status, 200);
  assert.ok(spec.text.includes("Model Context Protocol"));

  const blocked = await callTool("net_check_url_head", {
    url: "https://127.0.0.1/",
  });
  assert.equal(blocked.success, false);
  assert.match(blocked.error, /allowlisted|blocked/i);

  console.log("smoke_stage1_network ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
