const assert = require("node:assert/strict");
const { getPluginRegistryStatus, listPluginRegistry } = require("../src/plugin_registry");
const { getPluginVisibilityStatus } = require("../src/plugin_visibility");
const { getSessionToolsetStatus } = require("../src/session_toolset");
const { getPluginExecutionGovernance, preflightPluginExecution } = require("../src/plugin_execution");

(async () => {
  const registry = await getPluginRegistryStatus();
  assert.equal(registry.ok, true);
  assert.equal(registry.mode, "preview-only");
  assert.equal(registry.discovered_count, 1);
  assert.equal(registry.valid_count, 1);
  assert.equal(registry.invalid_count, 0);
  assert.equal(registry.candidate_tool_count, 1);
  assert.equal(registry.executable_tool_count, 0);
  assert.equal(registry.dynamic_import_enabled, false);
  assert.equal(registry.list_changed_enabled, false);
  assert.deepEqual(registry.errors, []);

  const list = await listPluginRegistry();
  assert.equal(list.ok, true);
  assert.equal(list.plugins.length, 1);
  assert.equal(list.candidate_tools.length, 1);
  assert.equal(list.candidate_tools[0].tool_name, "plugin_sample_echo_preview");
  assert.equal(list.plugins[0].status, "candidate");
  assert.equal(list.plugins[0].tools[0].execution.dynamic_import, false);
  assert.equal(list.plugins[0].tools[0].execution.allowlisted, true);
  assert.equal(list.plugins[0].tools[0].execution.readonly_wrapper, true);

  const visibility = await getPluginVisibilityStatus({ activeCoreTools: Array.from({ length: 40 }, (_, i) => `core_${i}`) });
    assert.equal(visibility.mode, "visibility-preview-only");
  assert.equal(visibility.tool_surface_mutation_enabled, false);
  assert.equal(visibility.dynamic_import_enabled, false);
  assert.equal(visibility.plugin_execution_enabled, false);
  assert.equal(visibility.list_changed_enabled, false);
  assert.equal(visibility.active_core_tool_count, 13);
  assert.equal(visibility.candidate_tool_count, 1);
  assert.equal(visibility.visible_candidate_tool_count, 0);
  assert.equal(visibility.executable_candidate_tool_count, 0);
  assert.equal(visibility.candidate_tools[0].visible_in_tools_list, false);
  assert.equal(visibility.candidate_tools[0].execution_enabled, false);
  assert.equal(visibility.list_changed.list_changed_required_for_real_visibility_change, true);
  assert.equal(visibility.list_changed.list_changed_enabled_now, false);

  const session = await getSessionToolsetStatus({ activeCoreToolCount: 40 });
    assert.equal(session.mode, "session-toolset-preview-only");
  assert.equal(session.gateway.gateway_server_enabled, false);
  assert.equal(session.gateway.session_store_enabled, false);
  assert.equal(session.gateway.per_session_tools_list_enabled, false);
  assert.equal(session.gateway.list_changed_enabled, false);
  assert.equal(session.current_global_tool_surface_count, 13);
  assert.equal(session.dynamic_import_enabled, false);
  assert.equal(session.plugin_execution_enabled, false);
  assert.equal(session.per_session_tools_list_enabled, false);
  assert.equal(session.list_changed_enabled, false);
  assert.ok(session.gateway.blockers.includes("no durable session store yet"));
  assert.ok(session.gateway.blockers.includes("no notifications/tools/list_changed emission yet"));

  const governance = getPluginExecutionGovernance();
  assert.equal(governance.success, true);
  assert.equal(governance.general_plugin_execution_allowed, false);
  assert.equal(governance.readonly_plugin_execution_wrapper_allowed, true);
  assert.equal(governance.dynamic_import_enabled, false);
  assert.equal(governance.arbitrary_plugin_file_execution_enabled, false);
  assert.equal(governance.real_tools_list_mutation_enabled, false);
  assert.equal(governance.list_changed_enabled, false);
  assert.deepEqual(governance.allowed_handler_types, ["builtin.echo.readonly.v1"]);
  assert.deepEqual(governance.allowed_risks, ["readonly-local"]);

  const preflight = await preflightPluginExecution({ tool_name: "plugin_sample_echo_preview" });
  assert.equal(preflight.success, true);
  assert.equal(preflight.plugin_id, "sample.echo_readonly");
  assert.equal(preflight.plugin_status, "candidate");
  assert.equal(preflight.handler_type, "builtin.echo.readonly.v1");
  assert.equal(preflight.execution_allowed_now, true);
  assert.equal(preflight.dynamic_import_enabled, false);
  assert.equal(preflight.plugin_execution_allowed, false);
  assert.equal(preflight.real_tools_list_mutation_enabled, false);
  assert.equal(preflight.list_changed_enabled, false);
  assert.deepEqual(preflight.errors, []);
  assert.equal(preflight.audit_envelope.dynamic_import_enabled, false);
  assert.equal(preflight.audit_envelope.real_tools_list_mutation_enabled, false);
  assert.equal(preflight.audit_envelope.list_changed_enabled, false);

  console.log("smoke_stage8_27_plugin_preview_freshness ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
