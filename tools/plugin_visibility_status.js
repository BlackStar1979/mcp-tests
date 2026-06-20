const { EMPTY_INPUT_SCHEMA, PLUGIN_VISIBILITY_STATUS_OUTPUT_SCHEMA, READ_ONLY_PLUGIN_VISIBILITY_ANNOTATIONS } = require("../src/schemas/plugin_visibility_tools");
const { getPluginVisibilityStatus } = require("../src/plugin_visibility");

const TOOL_NAME = "plugin_visibility_status";

async function execute() {
  try {
    return await getPluginVisibilityStatus();
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
      list_changed: {
        list_changed_required_for_real_visibility_change: false,
        list_changed_enabled_now: false,
      },
    };
  }
}

const pluginVisibilityStatusTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Plugin visibility status",
    description: "Read-only preview status for plug-in tool visibility. Does not mutate tools/list, emit list_changed, import, or execute plug-ins.",
    inputSchema: EMPTY_INPUT_SCHEMA,
    outputSchema: PLUGIN_VISIBILITY_STATUS_OUTPUT_SCHEMA,
    annotations: READ_ONLY_PLUGIN_VISIBILITY_ANNOTATIONS,
  },
  execute,
  summarizeArgs() { return { operation: "plugin_visibility_status" }; },
  resultStats(payload = {}) { return { result_count: payload.candidate_tool_count || 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { pluginVisibilityStatusTool };
