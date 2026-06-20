const { GENERIC_PLUGIN_EXECUTION_OUTPUT_SCHEMA, PLUGIN_EXECUTION_GOVERNANCE_INPUT_SCHEMA, READ_ONLY_PLUGIN_EXECUTION_ANNOTATIONS } = require("../src/schemas/plugin_execution_tools");
const { getPluginExecutionGovernance } = require("../src/plugin_execution");

const TOOL_NAME = "plugin_execution_governance";

async function execute() {
  try {
    return getPluginExecutionGovernance();
  } catch (error) {
    return { success: false, error: error?.message || String(error), mode: "plugin-execution-governance", general_plugin_execution_allowed: false, readonly_plugin_execution_wrapper_allowed: false, dynamic_import_enabled: false, arbitrary_plugin_file_execution_enabled: false, real_tools_list_mutation_enabled: false, list_changed_enabled: false, deny_matrix: [] };
  }
}

const pluginExecutionGovernanceTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Plugin execution governance",
    description: "Read-only governance status and capability deny matrix for TEST MCP plug-in execution wrapper.",
    inputSchema: PLUGIN_EXECUTION_GOVERNANCE_INPUT_SCHEMA,
    outputSchema: GENERIC_PLUGIN_EXECUTION_OUTPUT_SCHEMA,
    annotations: READ_ONLY_PLUGIN_EXECUTION_ANNOTATIONS,
  },
  execute,
  summarizeArgs() { return { operation: "plugin_execution_governance" }; },
  resultStats(payload = {}) { return { result_count: Array.isArray(payload.deny_matrix) ? payload.deny_matrix.length : 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { pluginExecutionGovernanceTool };
