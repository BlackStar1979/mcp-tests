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
  const status = await callTool("plugin_visibility_status", {});
  assert.equal(status.success, true);
  assert.equal(status.mode, "visibility-preview-only");
  assert.equal(status.tool_surface_mutation_enabled, false);
  assert.equal(status.dynamic_import_enabled, false);
  assert.equal(status.plugin_execution_enabled, false);
  assert.equal(status.list_changed_enabled, false);
  assert.equal(status.active_core_tool_count, 13);
  assert.equal(status.candidate_tool_count, 1);
  assert.equal(status.visible_candidate_tool_count, 0);
  assert.equal(status.executable_candidate_tool_count, 0);
  assert.equal(status.candidate_tools[0].tool_name, "plugin_sample_echo_preview");
  assert.equal(status.list_changed.list_changed_required_for_real_visibility_change, true);
  assert.equal(status.list_changed.list_changed_enabled_now, false);

  const enablePlan = await callTool("plugin_visibility_plan", {
    tool_name: "plugin_sample_echo_preview",
    target_state: "enabled",
  });
  assert.equal(enablePlan.success, true);
  assert.equal(enablePlan.mode, "visibility-preview-only");
  assert.equal(enablePlan.real_mutation_enabled, false);
  assert.equal(enablePlan.execute_allowed_now, false);
  assert.equal(enablePlan.dynamic_import_enabled, false);
  assert.equal(enablePlan.plugin_execution_enabled, false);
  assert.equal(enablePlan.list_changed_enabled, false);
  assert.equal(enablePlan.current_visible_in_tools_list, false);
  assert.equal(enablePlan.target_visible_in_tools_list, true);
  assert.equal(enablePlan.would_change_tools_list, true);
  assert.equal(enablePlan.would_require_list_changed, true);
  assert.deepEqual(enablePlan.planned_diff.add_to_tools_list, ["plugin_sample_echo_preview"]);

  const quarantinePlan = await callTool("plugin_visibility_plan", {
    tool_name: "plugin_sample_echo_preview",
    target_state: "quarantined",
  });
  assert.equal(quarantinePlan.success, true);
  assert.equal(quarantinePlan.target_visible_in_tools_list, false);
  assert.equal(quarantinePlan.would_change_tools_list, false);
  assert.equal(quarantinePlan.execute_allowed_now, false);

  const missing = await callTool("plugin_visibility_plan", {
    tool_name: "missing_plugin_tool",
    target_state: "enabled",
  });
  assert.equal(missing.success, false);
  assert.equal(missing.real_mutation_enabled, false);
  assert.equal(missing.execute_allowed_now, false);

  console.log("smoke_stage7_3_plugin_visibility ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
