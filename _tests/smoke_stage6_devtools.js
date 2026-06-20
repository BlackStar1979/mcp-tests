const assert = require("node:assert/strict");

const MCP_URL = process.env.MCP_TEST_SMOKE_URL || "http://127.0.0.1:3009/mcp";

async function callTool(name, args) {
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
  const json = await response.json();
  assert.ok(json.result, `${name} must return result`);
  const text = json.result?.content?.[0]?.text || "";
  assert.ok(text, `${name} must return text payload`);
  return JSON.parse(text);
}

(async () => {
  const symbols = await callTool("dev_code_symbols", { path: "server.js" });
  assert.equal(symbols.success, true);
  assert.ok(symbols.symbol_count > 0);
  assert.equal(symbols.language, "javascript");

  const deps = await callTool("dev_code_dependencies", { path: "tools", recursive: true, max_files: 100 });
  assert.equal(deps.success, true);
  assert.ok(deps.nodes_count > 0);
  assert.ok(deps.external_workspace_edges_count > 0);
  assert.ok(deps.external_workspace_edges.some((edge) => edge.to === "src/schemas/dev_tools.js"));
  assert.ok(deps.external_workspace_edges.some((edge) => edge.to === "src/util/code_workspace.js"));

  const audit = await callTool("dev_code_audit", { path: "tools", recursive: true, max_files: 100, top_n: 5 });
  assert.equal(audit.success, true);
  assert.ok(audit.summary.nodes > 0);

  const impact = await callTool("dev_code_impact", {
    path: "tools",
    target: "tools/dev_code_symbols.js",
    recursive: true,
    max_files: 500,
    max_depth: 3,
    direction: "both",
  });
  assert.equal(impact.success, true);
  assert.equal(impact.found, true);

  const syntax = await callTool("dev_code_syntax_check", { path: "tools/dev_code_symbols.js" });
  assert.equal(syntax.success, true);
  assert.equal(syntax.ok, true);
  assert.equal(syntax.language, "javascript");

  const denied = await callTool("dev_code_symbols", { path: "../mcp/server.js" });
  assert.equal(denied.success, false);
  assert.match(denied.error, /traversal|absolute|drive|escapes|denied/i);

  console.log("smoke_stage6_devtools ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
