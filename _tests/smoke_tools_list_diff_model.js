const assert = require("node:assert/strict");
const { planPluginVisibility } = require("../src/plugin_visibility");
const {
  buildTargetToolListFromVisibilityPlan,
  diffToolLists,
  hashToolList,
  normalizeToolList,
  planToolsListDiffForVisibilityPlan,
} = require("../src/tools_list_diff");

(async () => {
  assert.deepEqual(normalizeToolList(["b", "a", "b", "bad name", "plugin.sample"]), ["a", "b", "plugin.sample"]);
  assert.equal(hashToolList(["b", "a"]), hashToolList(["a", "b"]));

  const direct = diffToolLists({ current: ["a", "b"], target: ["b", "c"] });
  assert.equal(direct.success, true);
  assert.equal(direct.mode, "tools-list-diff-preview-only");
  assert.deepEqual(direct.add, ["c"]);
  assert.deepEqual(direct.remove, ["a"]);
  assert.deepEqual(direct.unchanged, ["b"]);
  assert.equal(direct.would_change_tools_list, true);
  assert.equal(direct.would_require_list_changed, true);
  assert.equal(direct.list_changed_enabled_now, false);
  assert.equal(direct.execute_allowed_now, false);
  assert.equal(direct.real_mutation_enabled, false);
  assert.ok(direct.blockers.includes("real tools/list mutation is disabled"));
  assert.ok(direct.blockers.includes("notifications/tools/list_changed emission is disabled"));

  const noop = diffToolLists({ current: ["a", "b"], target: ["b", "a"] });
  assert.equal(noop.change_count, 0);
  assert.equal(noop.would_change_tools_list, false);
  assert.equal(noop.would_require_list_changed, false);
  assert.deepEqual(noop.required_approvals, []);
  assert.deepEqual(noop.blockers, []);

  const current = ["plugin_visibility_plan", "plugin_visibility_status"];
  const enablePlan = await planPluginVisibility({ tool_name: "plugin_sample_echo_preview", target_state: "enabled" });
  const targetFromPlan = buildTargetToolListFromVisibilityPlan({ current, plan: enablePlan });
  assert.deepEqual(targetFromPlan, ["plugin_sample_echo_preview", "plugin_visibility_plan", "plugin_visibility_status"]);

  const enableDiff = planToolsListDiffForVisibilityPlan({ current, plan: enablePlan });
  assert.equal(enableDiff.source, "plugin_visibility_plan");
  assert.equal(enableDiff.source_success, true);
  assert.equal(enableDiff.source_tool_name, "plugin_sample_echo_preview");
  assert.equal(enableDiff.source_target_state, "enabled");
  assert.deepEqual(enableDiff.add, ["plugin_sample_echo_preview"]);
  assert.deepEqual(enableDiff.remove, []);
  assert.equal(enableDiff.would_require_list_changed, true);
  assert.equal(enableDiff.real_mutation_enabled, false);
  assert.equal(enableDiff.execute_allowed_now, false);

  const enabledOverlayDisablePlan = await planPluginVisibility({
    tool_name: "plugin_sample_echo_preview",
    target_state: "disabled",
    state_store: {
      records: [
        {
          tool_name: "plugin_sample_echo_preview",
          state: "enabled",
          source: "operator-state-store",
          updated_at: "2026-05-21T00:00:00.000Z",
          updated_by: "operator",
          reason: "test",
        },
      ],
    },
  });
  const removeDiff = planToolsListDiffForVisibilityPlan({
    current: ["plugin_sample_echo_preview", "plugin_visibility_plan"],
    plan: enabledOverlayDisablePlan,
  });
  assert.deepEqual(removeDiff.add, []);
  assert.deepEqual(removeDiff.remove, ["plugin_sample_echo_preview"]);
  assert.equal(removeDiff.would_require_list_changed, true);
  assert.equal(removeDiff.real_mutation_enabled, false);

  console.log("smoke_tools_list_diff_model ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
