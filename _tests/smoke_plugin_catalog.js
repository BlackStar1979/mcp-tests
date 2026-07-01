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
  const json = await response.json();
  assert.ok(json.result, `${name} must return result`);
  const text = json.result?.content?.[0]?.text || "";
  assert.ok(text, `${name} must return content[0].text`);
  return JSON.parse(text);
}

(async () => {
  const nameOnly = await callTool("plugin_catalog_search", {
    query: "echo",
    detail_level: "name",
    max_results: 10,
  });
  assert.equal(nameOnly.success, true);
  assert.equal(nameOnly.mode, "catalog-preview-only");
  assert.equal(nameOnly.dynamic_import_enabled, false);
  assert.equal(nameOnly.executable_tool_count, 0);
  assert.equal(nameOnly.list_changed_enabled, false);
  assert.equal(nameOnly.total_candidates, 1);
  assert.equal(nameOnly.matched_count, 1);
  assert.equal(nameOnly.returned_count, 1);
  assert.equal(nameOnly.results[0].tool_name, "plugin_sample_echo_preview");
  assert.equal(Object.prototype.hasOwnProperty.call(nameOnly.results[0], "description"), false);

  const summary = await callTool("plugin_catalog_search", {
    query: "preview",
    tag: "stage7",
    profile: "public",
    risk: "readonly-local",
    detail_level: "summary",
    max_results: 5,
  });
  assert.equal(summary.success, true);
  assert.equal(summary.returned_count, 1);
  assert.equal(summary.results[0].plugin_id, "sample.echo_readonly");
  assert.equal(summary.results[0].risk, "readonly-local");
  assert.equal(summary.results[0].public_safe, true);

  const full = await callTool("plugin_catalog_describe", {
    tool_name: "plugin_sample_echo_preview",
    detail_level: "full",
  });
  assert.equal(full.success, true);
  assert.equal(full.mode, "catalog-preview-only");
  assert.equal(full.dynamic_import_enabled, false);
  assert.equal(full.executable_tool_count, 0);
  assert.equal(full.list_changed_enabled, false);
  assert.equal(full.tool.tool_name, "plugin_sample_echo_preview");
  assert.equal(full.tool.plugin_id, "sample.echo_readonly");
  assert.equal(full.tool.risk, "readonly-local");
  assert.equal(full.tool.has_input_schema, true);
  assert.equal(full.tool.has_output_schema, true);

  const missing = await callTool("plugin_catalog_describe", {
    tool_name: "missing_plugin_tool",
  });
  assert.equal(missing.success, false);
  assert.equal(missing.tool, null);

  console.log("smoke_plugin_catalog ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
