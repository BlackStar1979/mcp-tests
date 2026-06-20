const assert = require("node:assert/strict");
const { pluginVisibilityStatusTool } = require("../tools/plugin_visibility_status");
const { PLUGIN_VISIBILITY_STATUS_OUTPUT_SCHEMA } = require("../src/schemas/plugin_visibility_tools");
const { assertMatchesSchema, validateAgainstSchema } = require("../src/output_schema_guard");

(async () => {
  const payload = await pluginVisibilityStatusTool.execute({});
  assert.equal(payload.success, true);
  assert.doesNotThrow(() => assertMatchesSchema(payload, PLUGIN_VISIBILITY_STATUS_OUTPUT_SCHEMA, "plugin_visibility_status"));
  assert.equal(payload.tool_surface_mutation_enabled, false);
  assert.equal(payload.dynamic_import_enabled, false);
  assert.equal(payload.plugin_execution_enabled, false);
  assert.equal(payload.list_changed_enabled, false);
  assert.equal(payload.candidate_tool_count, 1);
  assert.equal(payload.visible_candidate_tool_count, 0);
  assert.equal(payload.executable_candidate_tool_count, 0);

  const extra = { ...payload, unplanned_field: true };
  const extraResult = validateAgainstSchema(extra, PLUGIN_VISIBILITY_STATUS_OUTPUT_SCHEMA);
  assert.equal(extraResult.success, false);
  assert.ok(extraResult.issues.some((issue) => issue.path === "$.unplanned_field" && issue.message.includes("additional")));

  const original = pluginVisibilityStatusTool.execute;
  pluginVisibilityStatusTool.execute = async () => {
    try {
      throw new Error("forced visibility status failure");
    } catch (error) {
      return {
        success: false,
        error: error?.message || String(error),
        visibility_registry_version: "test-mcp-plugin-visibility-v1",
        mode: "visibility-preview-only",
        tool_surface_mutation_enabled: false,
        dynamic_import_enabled: false,
        plugin_execution_enabled: false,
        list_changed_enabled: false,
        active_core_tool_count: 0,
        active_core_tools: [],
        candidate_tool_count: 0,
        visible_candidate_tool_count: 0,
        executable_candidate_tool_count: 0,
        candidate_by_state: {},
        candidate_tools: [],
        registry_ok: false,
        registry_errors: [error?.message || String(error)],
        list_changed: { list_changed_required_for_real_visibility_change: false, list_changed_enabled_now: false },
      };
    }
  };
  const fallback = await pluginVisibilityStatusTool.execute({});
  pluginVisibilityStatusTool.execute = original;
  assert.equal(fallback.success, false);
  assert.doesNotThrow(() => assertMatchesSchema(fallback, PLUGIN_VISIBILITY_STATUS_OUTPUT_SCHEMA, "plugin_visibility_status fallback"));

  console.log("smoke_stage8_31_plugin_visibility_status_output_schema ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
