const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { getPluginVisibilityStatus, planPluginVisibility } = require("../src/plugin_visibility");
const { getSessionToolsetStatus } = require("../src/session_toolset");
const { getPluginExecutionGovernance } = require("../src/plugin_execution");
const { getPluginRegistryStatus } = require("../src/plugin_registry");

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

(async () => {
  const serverJs = read("server.js");
  const initializeResponseJs = read("src/runtime/initialize_response.js");
  assert.match(initializeResponseJs, /listChanged:\s*false/);
  assert.equal(serverJs.includes("notifications/tools/list_changed"), false, "server.js must not emit tools/list_changed yet");
  assert.equal(initializeResponseJs.includes("notifications/tools/list_changed"), false, "initialize response builder must not emit tools/list_changed yet");
  assert.equal(/jsonrpc[\s\S]{0,160}notifications\/tools\/list_changed/.test(serverJs), false, "no raw list_changed notification should be present in server.js");
  assert.equal(/jsonrpc[\s\S]{0,160}notifications\/tools\/list_changed/.test(initializeResponseJs), false, "no raw list_changed notification should be present in initialize_response.js");

  const visibility = await getPluginVisibilityStatus({ activeCoreTools: Array.from({ length: 40 }, (_, i) => `core_${i}`) });
  assert.equal(visibility.tool_surface_mutation_enabled, false);
  assert.equal(visibility.dynamic_import_enabled, false);
  assert.equal(visibility.plugin_execution_enabled, false);
  assert.equal(visibility.list_changed_enabled, false);
  assert.equal(visibility.visible_candidate_tool_count, 0);
  assert.equal(visibility.executable_candidate_tool_count, 0);
  assert.equal(visibility.list_changed.list_changed_required_for_real_visibility_change, true);
  assert.equal(visibility.list_changed.list_changed_enabled_now, false);

  const plan = await planPluginVisibility({ tool_name: "plugin_sample_echo_preview", target_state: "enabled" });
  assert.equal(plan.success, true);
  assert.equal(plan.would_require_list_changed, true);
  assert.equal(plan.real_mutation_enabled, false);
  assert.equal(plan.execute_allowed_now, false);
  assert.equal(plan.dynamic_import_enabled, false);
  assert.equal(plan.plugin_execution_enabled, false);
  assert.equal(plan.list_changed_enabled, false);
  assert.equal(plan.list_changed.list_changed_required_for_real_visibility_change, true);
  assert.equal(plan.list_changed.list_changed_enabled_now, false);
  assert.ok(plan.required_approvals.some((item) => item.includes("list_changed") || item.includes("client refresh")));

  const session = await getSessionToolsetStatus({ activeCoreToolCount: 40 });
  assert.equal(session.gateway.gateway_server_enabled, false);
  assert.equal(session.gateway.session_store_enabled, false);
  assert.equal(session.gateway.per_session_tools_list_enabled, false);
  assert.equal(session.gateway.list_changed_enabled, false);
  assert.equal(session.per_session_tools_list_enabled, false);
  assert.equal(session.list_changed_enabled, false);
  assert.ok(session.gateway.blockers.includes("no notifications/tools/list_changed emission yet"));

  const governance = getPluginExecutionGovernance();
  assert.equal(governance.real_tools_list_mutation_enabled, false);
  assert.equal(governance.list_changed_enabled, false);
  assert.equal(governance.dynamic_import_enabled, false);
  assert.equal(governance.general_plugin_execution_allowed, false);

  const registry = await getPluginRegistryStatus();
  assert.equal(registry.dynamic_import_enabled, false);
  assert.equal(registry.list_changed_enabled, false);
  assert.equal(registry.executable_tool_count, 0);

  console.log("smoke_stage8_33_list_changed_readiness_contract ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
