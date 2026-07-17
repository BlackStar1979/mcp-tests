"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

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

  const workspaceFs = require("../src/util/workspace_fs");
  const tempDir = path.join(__dirname, "..", "_tmp");
  const tempFile = path.join(tempDir, "workspace-fs-read-file-streaming.txt");
  const tempRelative = "mcp-tests/_tmp/workspace-fs-read-file-streaming.txt";
  const source = Array.from({ length: 1200 }, (_, index) => `line-${String(index + 1).padStart(4, "0")} ${"x".repeat(64)}`).join("\n");
  const originalReadFile = fs.readFile;
  let blockedCalls = 0;

  await fs.mkdir(tempDir, { recursive: true });
  await fs.writeFile(tempFile, source, "utf8");
  fs.readFile = async function blocked(...args) {
    blockedCalls += 1;
    throw new Error(`fs.promises.readFile was called: ${args[0]}`);
  };

  try {
    const streamed = await workspaceFs.readFile(tempRelative, { maxChars: 120 });
    assert.equal(streamed.chars, source.length);
    assert.equal(streamed.returned_chars, 120);
    assert.equal(streamed.total_lines, source.split(/\r\n|\n|\r/).length);
    assert.equal(streamed.truncated, true);
    assert.equal(streamed.text, source.slice(0, 120));
    assert.equal(blockedCalls, 0);

    const streamedLines = await workspaceFs.readFileLines(tempRelative, {
      startLine: 100,
      endLine: 102,
      maxChars: 1000,
    });
    assert.equal(streamedLines.total_lines, source.split(/\r\n|\n|\r/).length);
    assert.equal(streamedLines.returned_lines, 3);
    assert.equal(streamedLines.text, [
      `L100 ${source.split("\n")[99]}`,
      `L101 ${source.split("\n")[100]}`,
      `L102 ${source.split("\n")[101]}`,
    ].join("\n"));
    assert.equal(blockedCalls, 0);

    const streamedChunk = await workspaceFs.readFileChunk(tempRelative, {
      offset: 10,
      length: 50,
    });
    assert.equal(streamedChunk.chars, source.length);
    assert.equal(streamedChunk.returned_chars, 50);
    assert.equal(streamedChunk.text, source.slice(10, 60));
    assert.equal(streamedChunk.has_more, true);
    assert.equal(blockedCalls, 0);
  } finally {
    fs.readFile = originalReadFile;
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  console.log("smoke_workspace_fs_tools ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
