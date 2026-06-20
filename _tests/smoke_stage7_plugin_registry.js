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
  const status = await callTool("plugin_registry_status", {});
  assert.equal(status.success, true);
  assert.equal(status.mode, "preview-only");
  assert.equal(status.dynamic_import_enabled, false);
  assert.equal(status.list_changed_enabled, false);
  assert.equal(status.executable_tool_count, 0);
  assert.equal(status.discovered_count, 1);
  assert.equal(status.valid_count, 1);
  assert.equal(status.invalid_count, 0);
  assert.equal(status.candidate_tool_count, 1);
  assert.equal(status.ok, true, JSON.stringify(status.errors));

  const listed = await callTool("plugin_registry_list", {});
  assert.equal(listed.success, true);
  assert.equal(listed.plugins.length, 1);
  assert.equal(listed.candidate_tools.length, 1);
  assert.equal(listed.candidate_tools[0].tool_name, "plugin_sample_echo_preview");
  assert.equal(listed.candidate_tools[0].risk, "readonly-local");

  const plugin = await callTool("plugin_registry_get", { plugin_id: "sample.echo_readonly" });
  assert.equal(plugin.success, true);
  assert.equal(plugin.plugin.plugin_id, "sample.echo_readonly");
  assert.equal(plugin.plugin.validation.ok, true);
  assert.equal(plugin.plugin.tools[0].name, "plugin_sample_echo_preview");

  const audit = await callTool("plugin_registry_audit", {});
  assert.equal(audit.success, true);
  assert.equal(audit.ok, true, JSON.stringify(audit.errors));
  assert.equal(audit.risk_counts["readonly-local"], 1);

  const missing = await callTool("plugin_registry_get", { plugin_id: "missing.plugin" });
  assert.equal(missing.success, false);

  console.log("smoke_stage7_plugin_registry ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
