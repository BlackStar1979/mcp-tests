"use strict";

const assert = require("node:assert/strict");

const MCP_URL = process.env.MCP_TEST_SMOKE_URL || "http://127.0.0.1:3009/mcp";

async function postRpc(payload) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 200, "HTTP status must remain 200 for JSON-RPC protocol errors");
  return response.json();
}

(async () => {
  const unknown = await postRpc({
    jsonrpc: "2.0",
    id: "step38g-unknown-tool",
    method: "tools/call",
    params: {
      name: "stage12_step38g_unregistered_tool",
      arguments: {},
    },
  });

  assert.equal(unknown.id, "step38g-unknown-tool");
  assert.equal(unknown.error.code, -32602);
  assert.match(unknown.error.message, /Unknown tool: stage12_step38g_unregistered_tool/);
  assert.equal(unknown.result, undefined);

  const malformed = await postRpc({
    jsonrpc: "2.0",
    id: "step38g-missing-tool-name",
    method: "tools/call",
    params: {
      arguments: {},
    },
  });

  assert.equal(malformed.id, "step38g-missing-tool-name");
  assert.equal(malformed.error.code, -32602);
  assert.match(malformed.error.message, /Invalid tool call decision context/);
  assert.equal(malformed.result, undefined);

  console.log("smoke_raw_rpc_unknown_tool ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
