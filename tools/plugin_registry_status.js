const { EMPTY_INPUT_SCHEMA, GENERIC_PLUGIN_REGISTRY_OUTPUT_SCHEMA, READ_ONLY_PLUGIN_REGISTRY_ANNOTATIONS } = require("../src/schemas/plugin_registry_tools");
const { getPluginRegistryStatus } = require("../src/plugin_registry");

const TOOL_NAME = "plugin_registry_status";

async function execute() {
  try {
    return { success: true, error: "", ...(await getPluginRegistryStatus()) };
  } catch (error) {
    return { success: false, error: error?.message || String(error), registry_version: "", mode: "preview-only", discovered_count: 0, valid_count: 0, invalid_count: 0, candidate_tool_count: 0, executable_tool_count: 0, dynamic_import_enabled: false, list_changed_enabled: false, ok: false, errors: [], warnings: [] };
  }
}

const pluginRegistryStatusTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Plugin registry status",
    description: "Read-only preview status for TEST MCP plug-in manifest registry. Does not import or execute plug-in code.",
    inputSchema: EMPTY_INPUT_SCHEMA,
    outputSchema: GENERIC_PLUGIN_REGISTRY_OUTPUT_SCHEMA,
    annotations: READ_ONLY_PLUGIN_REGISTRY_ANNOTATIONS,
  },
  execute,
  summarizeArgs() { return { operation: "plugin_registry_status" }; },
  resultStats(payload = {}) { return { result_count: payload.discovered_count || 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { pluginRegistryStatusTool };
