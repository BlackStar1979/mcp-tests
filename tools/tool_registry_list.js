const {
  EMPTY_INPUT_SCHEMA,
  READ_ONLY_TOOL_REGISTRY_ANNOTATIONS,
  TOOL_REGISTRY_STATUS_OUTPUT_SCHEMA,
} = require("../src/schemas/tool_registry_tools");
const { buildRuntimeRegistryState, summarizeEntry } = require("../src/tool_registry_runtime");

const TOOL_NAME = "tool_registry_list";

function createToolRegistryListTool(getRuntimeRegistryContext) {
  return {
    name: TOOL_NAME,
    descriptor: {
      name: TOOL_NAME,
      title: "Tool registry list",
      description: "Read-only list of currently loaded TEST MCP tools with policy and catalog summaries normalized into one registry view.",
      inputSchema: EMPTY_INPUT_SCHEMA,
      outputSchema: TOOL_REGISTRY_STATUS_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_REGISTRY_ANNOTATIONS,
    },
    async execute() {
      try {
        const { model, version, registryId } = buildRuntimeRegistryState(getRuntimeRegistryContext, "tool_registry_list");
        const tools = model.entries().map(summarizeEntry);
        return {
          success: true,
          error: "",
          status: "ok",
          connector_safe: true,
          dispatch_enabled: false,
          registry_version: version,
          registry_id: registryId,
          tool_count: tools.length,
          enabled_tool_count: tools.length,
          tools,
        };
      } catch (error) {
        return { success: false, error: error?.message || String(error), status: "error", connector_safe: true, dispatch_enabled: false, registry_version: "", registry_id: "", tool_count: 0, enabled_tool_count: 0, tools: [] };
      }
    },
    summarizeArgs() { return { operation: TOOL_NAME }; },
    resultStats(payload = {}) { return { result_count: payload.tool_count || 0, result_chars: JSON.stringify(payload || {}).length }; },
  };
}

module.exports = { createToolRegistryListTool };
