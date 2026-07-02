const assert = require("node:assert/strict");
const { pluginVisibilityPlanTool } = require("../tools/plugin_visibility_plan");
const { PLUGIN_VISIBILITY_PLAN_OUTPUT_SCHEMA } = require("../src/schemas/plugin_visibility_tools");
const { assertMatchesSchema, validateAgainstSchema } = require("../src/output_schema_guard");

(async () => {
  for (const target_state of ["enabled", "disabled", "quarantined", "candidate"]) {
    const payload = await pluginVisibilityPlanTool.execute({ tool_name: "plugin_sample_echo_preview", target_state });
    assert.equal(payload.success, true, `${target_state} should plan successfully`);
    assert.doesNotThrow(() => assertMatchesSchema(payload, PLUGIN_VISIBILITY_PLAN_OUTPUT_SCHEMA, `plugin_visibility_plan ${target_state}`));
    assert.equal(payload.real_mutation_enabled, false);
    assert.equal(payload.execute_allowed_now, false);
    assert.equal(payload.dynamic_import_enabled, false);
    assert.equal(payload.plugin_execution_enabled, false);
    assert.equal(payload.list_changed_enabled, false);
    assert.equal(payload.state_overlay.read_only_overlay, true);
    assert.equal(payload.state_overlay.persisted_state_file_enabled, false);
  }

  const missing = await pluginVisibilityPlanTool.execute({ tool_name: "does_not_exist", target_state: "enabled" });
  assert.equal(missing.success, false);
  assert.doesNotThrow(() => assertMatchesSchema(missing, PLUGIN_VISIBILITY_PLAN_OUTPUT_SCHEMA, "plugin_visibility_plan fallback"));
  assert.equal(missing.real_mutation_enabled, false);
  assert.equal(missing.execute_allowed_now, false);
  assert.ok(missing.blockers.length > 0);

  const extra = await pluginVisibilityPlanTool.execute({ tool_name: "plugin_sample_echo_preview", target_state: "enabled" });
  extra.unplanned_field = true;
  const extraResult = validateAgainstSchema(extra, PLUGIN_VISIBILITY_PLAN_OUTPUT_SCHEMA);
  assert.equal(extraResult.success, false);
  assert.ok(extraResult.issues.some((issue) => issue.path === "$.unplanned_field" && issue.message.includes("additional")));

  console.log("smoke_plugin_visibility_plan_output_schema ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
