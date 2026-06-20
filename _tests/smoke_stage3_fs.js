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
  const listing = await callTool("fs_list_public", { path: "." });
  assert.equal(listing.success, true);
  assert.ok(listing.entries.some((entry) => entry.path === "README.md"));
  assert.ok(listing.entries.some((entry) => entry.path === "docs"));

  const info = await callTool("fs_get_public_info", { path: "docs/hello.txt" });
  assert.equal(info.success, true);
  assert.equal(info.kind, "file");
  assert.ok(info.size_bytes > 0);

  const text = await callTool("fs_read_public_text", {
    path: "docs/hello.txt",
    max_chars: 2000,
  });
  assert.equal(text.success, true);
  assert.match(text.text, /TEST MCP public filesystem sandbox/);

  const lines = await callTool("fs_read_public_lines", {
    path: "docs/hello.txt",
    start_line: 1,
    end_line: 2,
  });
  assert.equal(lines.success, true);
  assert.match(lines.text, /^1:/);

  const chunk = await callTool("fs_read_public_chunk", {
    path: "docs/hello.txt",
    offset: 0,
    length: 20,
  });
  assert.equal(chunk.success, true);
  assert.equal(chunk.text.length, 20);

  const traversal = await callTool("fs_read_public_text", { path: "../server.js" });
  assert.equal(traversal.success, false);
  assert.match(traversal.error, /traversal/i);

  const absolute = await callTool("fs_read_public_text", { path: "C:/Work/mcp-tests/server.js" });
  assert.equal(absolute.success, false);
  assert.match(absolute.error, /drive-letter/i);

  const dotDir = await callTool("fs_read_public_text", { path: ".temp/x.txt" });
  assert.equal(dotDir.success, false);
  assert.match(dotDir.error, /dot|underscore/i);

  const underscoreDir = await callTool("fs_read_public_text", { path: "_backups/server.js" });
  assert.equal(underscoreDir.success, false);
  assert.match(underscoreDir.error, /dot|underscore/i);

  const deniedExt = await callTool("fs_read_public_text", { path: "docs/private.pem" });
  assert.equal(deniedExt.success, false);
  assert.match(deniedExt.error, /denied|secret|private/i);

  console.log("smoke_stage3_fs ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
