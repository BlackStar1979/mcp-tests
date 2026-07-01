const assert = require("node:assert/strict");
const { planPluginVisibility } = require("../src/plugin_visibility");

(async () => {
  const defaultPlan = await planPluginVisibility({
    tool_name: "plugin_sample_echo_preview",
    target_state: "enabled",
  });
  assert.equal(defaultPlan.success, true);
  assert.equal(defaultPlan.current_state, "candidate");
  assert.equal(defaultPlan.target_state, "enabled");
  assert.equal(defaultPlan.current_visible_in_tools_list, false);
  assert.equal(defaultPlan.target_visible_in_tools_list, true);
  assert.equal(defaultPlan.would_change_tools_list, true);
  assert.equal(defaultPlan.would_require_list_changed, true);
  assert.equal(defaultPlan.real_mutation_enabled, false);
  assert.equal(defaultPlan.execute_allowed_now, false);
  assert.equal(defaultPlan.state_overlay.read_only_overlay, true);
  assert.equal(defaultPlan.state_overlay.persisted_state_file_enabled, false);
  assert.equal(defaultPlan.state_overlay.source, "manifest");
  assert.equal(defaultPlan.state_overlay.state_store_ok, true);
  assert.equal(defaultPlan.required_approvals.filter((item) => item.includes("operator approval")).length, 1);
  assert.equal(defaultPlan.required_approvals.filter((item) => item.includes("tools/list diff") || item.includes("visibility diff")).length, 1);
  assert.equal(defaultPlan.required_approvals.filter((item) => item.includes("list_changed") || item.includes("client refresh")).length, 1);

  const disabledOverlayPlan = await planPluginVisibility({
    tool_name: "plugin_sample_echo_preview",
    target_state: "enabled",
    state_store: {
      records: [
        {
          tool_name: "plugin_sample_echo_preview",
          state: "disabled",
          source: "operator-state-store",
          updated_at: "2026-05-20T00:00:00.000Z",
          updated_by: "operator",
          reason: "test disabled overlay",
        },
      ],
    },
  });
  assert.equal(disabledOverlayPlan.success, true);
  assert.equal(disabledOverlayPlan.current_state, "disabled");
  assert.equal(disabledOverlayPlan.target_state, "enabled");
  assert.equal(disabledOverlayPlan.current_visible_in_tools_list, false);
  assert.equal(disabledOverlayPlan.target_visible_in_tools_list, true);
  assert.equal(disabledOverlayPlan.state_overlay.source, "operator-state-store");
  assert.equal(disabledOverlayPlan.state_overlay.state_store_ok, true);
  assert.equal(disabledOverlayPlan.would_change_tools_list, true);
  assert.equal(disabledOverlayPlan.real_mutation_enabled, false);
  assert.equal(disabledOverlayPlan.execute_allowed_now, false);

  const enabledOverlayPlan = await planPluginVisibility({
    tool_name: "plugin_sample_echo_preview",
    target_state: "disabled",
    state_store: {
      records: [
        {
          tool_name: "plugin_sample_echo_preview",
          state: "enabled",
          source: "operator-state-store",
          updated_at: "2026-05-20T00:00:00.000Z",
          updated_by: "operator",
          reason: "test enabled overlay",
        },
      ],
    },
  });
  assert.equal(enabledOverlayPlan.success, true);
  assert.equal(enabledOverlayPlan.current_state, "enabled");
  assert.equal(enabledOverlayPlan.current_visible_in_tools_list, true);
  assert.equal(enabledOverlayPlan.target_visible_in_tools_list, false);
  assert.deepEqual(enabledOverlayPlan.planned_diff.remove_from_tools_list, ["plugin_sample_echo_preview"]);
  assert.equal(enabledOverlayPlan.would_require_list_changed, true);
  assert.equal(enabledOverlayPlan.real_mutation_enabled, false);

  const badStorePlan = await planPluginVisibility({
    tool_name: "plugin_sample_echo_preview",
    target_state: "enabled",
    state_store: {
      records: [
        { tool_name: "plugin_sample_echo_preview", state: "disabled" },
        { tool_name: "plugin_sample_echo_preview", state: "enabled" },
      ],
    },
  });
  assert.equal(badStorePlan.success, true);
  assert.equal(badStorePlan.state_overlay.state_store_ok, false);
  assert.ok(badStorePlan.state_overlay.state_store_error_count > 0);
  assert.equal(badStorePlan.real_mutation_enabled, false);
  assert.equal(badStorePlan.execute_allowed_now, false);

  console.log("smoke_plugin_visibility_state_overlay ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
