"use strict";

const assert = require("node:assert/strict");

const MCP_URL = process.env.MCP_TEST_SMOKE_URL || "http://127.0.0.1:3008/mcp";
const EXTRA_HEADERS = process.env.MCP_TEST_SMOKE_HEADERS_JSON ? JSON.parse(process.env.MCP_TEST_SMOKE_HEADERS_JSON) : {};

async function callTool(name, args) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...EXTRA_HEADERS },
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
  const listing = await callTool("list_directory", { path: "mcp-tests" });
  assert.equal(listing.success, true);
  assert.ok(listing.entries.some((entry) => entry.path === "mcp-tests/README.md"));
  assert.ok(listing.entries.some((entry) => entry.path === "mcp-tests/src"));

  const info = await callTool("get_info", { path: "mcp-tests/README.md" });
  assert.equal(info.success, true);
  assert.equal(info.type, "file");
  assert.equal(info.root_alias, "work");
  assert.ok(info.size > 0);

  const text = await callTool("read_file", {
    path: "mcp-tests/README.md",
    max_chars: 2000,
  });
  assert.equal(text.success, true);
  assert.match(text.text, /TEST MCP workbench/);

  const lines = await callTool("read_file_lines", {
    path: "mcp-tests/README.md",
    start_line: 1,
    end_line: 2,
  });
  assert.equal(lines.success, true);
  assert.match(lines.text, /^L1 /);

  const chunk = await callTool("read_file_chunk", {
    path: "mcp-tests/README.md",
    offset: 0,
    length: 20,
  });
  assert.equal(chunk.success, true);
  assert.equal(chunk.text.length, 20);

  const traversal = await callTool("read_file", { path: "../Windows/system.ini" });
  assert.equal(traversal.success, false);
  assert.match(traversal.error, /traversal|access denied/i);

  const absolute = await callTool("read_file", { path: "C:/Work/mcp-tests/README.md" });
  assert.equal(absolute.success, false);
  assert.match(absolute.error, /drive-letter/i);

  console.log("smoke_workspace_fs_tools ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
