const { EMPTY_INPUT_SCHEMA, GENERIC_PLUGIN_REGISTRY_OUTPUT_SCHEMA, READ_ONLY_PLUGIN_REGISTRY_ANNOTATIONS } = require("../src/schemas/plugin_registry_tools");
const { listPluginRegistry } = require("../src/plugin_registry");

const TOOL_NAME = "plugin_registry_list";

async function execute() {
  try {
    return { success: true, error: "", ...(await listPluginRegistry()) };
  } catch (error) {
    return { success: false, error: error?.message || String(error), registry_version: "", mode: "preview-only", plugins: [], candidate_tools: [], ok: false, errors: [], warnings: [] };
  }
}

const pluginRegistryListTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "List plugin registry",
    description: "Read-only list of validated TEST MCP plug-in manifests and candidate tools. Does not import or execute plug-in code.",
    inputSchema: EMPTY_INPUT_SCHEMA,
    outputSchema: GENERIC_PLUGIN_REGISTRY_OUTPUT_SCHEMA,
    annotations: READ_ONLY_PLUGIN_REGISTRY_ANNOTATIONS,
  },
  execute,
  summarizeArgs() { return { operation: "plugin_registry_list" }; },
  resultStats(payload = {}) { return { result_count: payload.candidate_tool_count || 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { pluginRegistryListTool };
