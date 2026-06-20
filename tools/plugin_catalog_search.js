const { GENERIC_PLUGIN_CATALOG_OUTPUT_SCHEMA, PLUGIN_CATALOG_SEARCH_INPUT_SCHEMA, READ_ONLY_PLUGIN_CATALOG_ANNOTATIONS } = require("../src/schemas/plugin_catalog_tools");
const { searchPluginCatalog } = require("../src/plugin_catalog");

const TOOL_NAME = "plugin_catalog_search";

async function execute(args = {}) {
  try {
    return await searchPluginCatalog(args);
  } catch (error) {
    return { success: false, error: error?.message || String(error), mode: "catalog-preview-only", query: String(args.query || ""), detail_level: String(args.detail_level || "summary"), total_candidates: 0, matched_count: 0, returned_count: 0, dynamic_import_enabled: false, executable_tool_count: 0, list_changed_enabled: false, results: [] };
  }
}

const pluginCatalogSearchTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Search plugin tool catalog",
    description: "Read-only progressive-discovery search over TEST MCP plug-in candidate tools. Does not import, execute, enable, or register plug-ins.",
    inputSchema: PLUGIN_CATALOG_SEARCH_INPUT_SCHEMA,
    outputSchema: GENERIC_PLUGIN_CATALOG_OUTPUT_SCHEMA,
    annotations: READ_ONLY_PLUGIN_CATALOG_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) { return { query: String(args.query || ""), detail_level: String(args.detail_level || "summary") }; },
  resultStats(payload = {}) { return { result_count: payload.returned_count || 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { pluginCatalogSearchTool };
