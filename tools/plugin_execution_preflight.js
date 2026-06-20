const { GENERIC_PLUGIN_EXECUTION_OUTPUT_SCHEMA, PLUGIN_EXECUTION_PREFLIGHT_INPUT_SCHEMA, READ_ONLY_PLUGIN_EXECUTION_ANNOTATIONS } = require("../src/schemas/plugin_execution_tools");
const { preflightPluginExecution } = require("../src/plugin_execution");

const TOOL_NAME = "plugin_execution_preflight";

async function execute(args = {}) {
  try {
    return await preflightPluginExecution(args);
  } catch (error) {
    return { success: false, error: error?.message || String(error), mode: "readonly-plugin-execution-preflight", tool_name: String(args.tool_name || ""), execution_allowed_now: false, readonly_plugin_execution_wrapper_allowed: false, dynamic_import_enabled: false, plugin_execution_allowed: false, real_tools_list_mutation_enabled: false, list_changed_enabled: false };
  }
}

const pluginExecutionPreflightTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Preflight read-only plugin execution",
    description: "Read-only preflight for manifest-backed TEST MCP plug-in execution wrapper. Does not import arbitrary plug-in files or mutate tools/list.",
    inputSchema: PLUGIN_EXECUTION_PREFLIGHT_INPUT_SCHEMA,
    outputSchema: GENERIC_PLUGIN_EXECUTION_OUTPUT_SCHEMA,
    annotations: READ_ONLY_PLUGIN_EXECUTION_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) { return { tool_name: String(args.tool_name || "") }; },
  resultStats(payload = {}) { return { result_count: payload.success ? 1 : 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { pluginExecutionPreflightTool };
