const { GENERIC_PLUGIN_EXECUTION_OUTPUT_SCHEMA, PLUGIN_EXECUTE_READONLY_INPUT_SCHEMA, READ_ONLY_PLUGIN_EXECUTION_ANNOTATIONS } = require("../src/schemas/plugin_execution_tools");
const { executeReadonlyPlugin } = require("../src/plugin_execution");

const TOOL_NAME = "plugin_execute_readonly";

async function execute(args = {}) {
  try {
    return await executeReadonlyPlugin(args);
  } catch (error) {
    return { success: false, error: error?.message || String(error), mode: "readonly-plugin-execution-wrapper", tool_name: String(args.tool_name || ""), result: null, execution_allowed_now: false, readonly_plugin_execution_wrapper_allowed: false, dynamic_import_enabled: false, plugin_execution_allowed: false, real_tools_list_mutation_enabled: false, list_changed_enabled: false };
  }
}

const pluginExecuteReadonlyTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Execute read-only plugin wrapper",
    description: "Controlled read-only execution wrapper for allowlisted manifest-backed TEST MCP plug-in handlers. Does not dynamically import plug-in files or mutate tools/list.",
    inputSchema: PLUGIN_EXECUTE_READONLY_INPUT_SCHEMA,
    outputSchema: GENERIC_PLUGIN_EXECUTION_OUTPUT_SCHEMA,
    annotations: READ_ONLY_PLUGIN_EXECUTION_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) { return { tool_name: String(args.tool_name || ""), has_text: typeof args.text === "string", input_keys: Object.keys(args.input || args.arguments || {}) }; },
  resultStats(payload = {}) { return { result_count: payload.success ? 1 : 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { pluginExecuteReadonlyTool };
