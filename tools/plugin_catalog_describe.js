const { GENERIC_PLUGIN_CATALOG_OUTPUT_SCHEMA, PLUGIN_CATALOG_DESCRIBE_INPUT_SCHEMA, READ_ONLY_PLUGIN_CATALOG_ANNOTATIONS } = require("../src/schemas/plugin_catalog_tools");
const { describePluginCatalogTool } = require("../src/plugin_catalog");

const TOOL_NAME = "plugin_catalog_describe";

async function execute(args = {}) {
  try {
    return await describePluginCatalogTool(args);
  } catch (error) {
    return { success: false, error: error?.message || String(error), mode: "catalog-preview-only", tool_name: String(args.tool_name || ""), dynamic_import_enabled: false, executable_tool_count: 0, list_changed_enabled: false, tool: null };
  }
}

const pluginCatalogDescribeTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Describe plugin catalog tool",
    description: "Read-only progressive-discovery detail view for one TEST MCP plug-in candidate tool. Does not import, execute, enable, or register plug-ins.",
    inputSchema: PLUGIN_CATALOG_DESCRIBE_INPUT_SCHEMA,
    outputSchema: GENERIC_PLUGIN_CATALOG_OUTPUT_SCHEMA,
    annotations: READ_ONLY_PLUGIN_CATALOG_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) { return { tool_name: String(args.tool_name || ""), detail_level: String(args.detail_level || "full") }; },
  resultStats(payload = {}) { return { result_count: payload.success ? 1 : 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { pluginCatalogDescribeTool };
