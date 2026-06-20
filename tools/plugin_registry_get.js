const { GENERIC_PLUGIN_REGISTRY_OUTPUT_SCHEMA, PLUGIN_ID_INPUT_SCHEMA, READ_ONLY_PLUGIN_REGISTRY_ANNOTATIONS } = require("../src/schemas/plugin_registry_tools");
const { getPlugin } = require("../src/plugin_registry");

const TOOL_NAME = "plugin_registry_get";

async function execute(args = {}) {
  try {
    return await getPlugin(args.plugin_id);
  } catch (error) {
    return { success: false, plugin_id: String(args.plugin_id || ""), error: error?.message || String(error), plugin: null };
  }
}

const pluginRegistryGetTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Get plugin registry entry",
    description: "Read-only metadata for one TEST MCP plug-in manifest entry. Does not import or execute plug-in code.",
    inputSchema: PLUGIN_ID_INPUT_SCHEMA,
    outputSchema: GENERIC_PLUGIN_REGISTRY_OUTPUT_SCHEMA,
    annotations: READ_ONLY_PLUGIN_REGISTRY_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) { return { plugin_id: String(args.plugin_id || "") }; },
  resultStats(payload = {}) { return { result_count: payload.success ? 1 : 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { pluginRegistryGetTool };
