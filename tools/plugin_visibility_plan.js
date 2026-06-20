const { PLUGIN_VISIBILITY_PLAN_INPUT_SCHEMA, PLUGIN_VISIBILITY_PLAN_OUTPUT_SCHEMA, READ_ONLY_PLUGIN_VISIBILITY_ANNOTATIONS } = require("../src/schemas/plugin_visibility_tools");
const { planPluginVisibility } = require("../src/plugin_visibility");

const TOOL_NAME = "plugin_visibility_plan";

async function execute(args = {}) {
  try {
    return await planPluginVisibility(args);
  } catch (error) {
    const targetState = String(args.target_state || "");
    return {
      success: false,
      error: error?.message || String(error),
      mode: "visibility-preview-only",
      tool_name: String(args.tool_name || ""),
      plugin_id: "",
      plugin_version: "",
      current_state: "unknown",
      target_state: targetState,
      state_overlay: {
        state_store_version: "test-mcp-plugin-visibility-state-v1",
        source: "fallback",
        state_store_ok: false,
        state_store_error_count: 1,
        state_store_warning_count: 0,
        read_only_overlay: true,
        persisted_state_file_enabled: false,
      },
      current_visible_in_tools_list: false,
      target_visible_in_tools_list: false,
      would_change_tools_list: false,
      would_require_list_changed: false,
      real_mutation_enabled: false,
      plan_allowed_now: false,
      execute_allowed_now: false,
      dynamic_import_enabled: false,
      plugin_execution_enabled: false,
      list_changed_enabled: false,
      risk: "",
      public_safe: false,
      profile_allowed: [],
      blockers: [error?.message || String(error)],
      warnings: [],
      required_approvals: [],
      planned_diff: { add_to_tools_list: [], remove_from_tools_list: [], state_change: { from: "unknown", to: targetState } },
      list_changed: { list_changed_required_for_real_visibility_change: false, list_changed_enabled_now: false },
      next_stage_hint: "Inspect plugin_visibility_plan error before retrying.",
    };
  }
}

const pluginVisibilityPlanTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Plan plugin visibility change",
    description: "Read-only deterministic plan for future plug-in tool visibility changes. Does not mutate tools/list, emit list_changed, import, or execute plug-ins.",
    inputSchema: PLUGIN_VISIBILITY_PLAN_INPUT_SCHEMA,
    outputSchema: PLUGIN_VISIBILITY_PLAN_OUTPUT_SCHEMA,
    annotations: READ_ONLY_PLUGIN_VISIBILITY_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) { return { tool_name: String(args.tool_name || ""), target_state: String(args.target_state || "") }; },
  resultStats(payload = {}) { return { result_count: payload.success ? 1 : 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { pluginVisibilityPlanTool };
