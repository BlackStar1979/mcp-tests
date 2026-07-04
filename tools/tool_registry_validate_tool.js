const {
  READ_ONLY_TOOL_REGISTRY_ANNOTATIONS,
  TOOL_NAME_INPUT_SCHEMA,
  TOOL_REGISTRY_VALIDATE_OUTPUT_SCHEMA,
} = require("../src/schemas/tool_registry_tools");
const { validateRegistryEntry } = require("../src/tool_registry_runtime");

const TOOL_NAME = "tool_registry_validate_tool";

function createToolRegistryValidateTool(getRuntimeRegistryContext) {
  return {
    name: TOOL_NAME,
    descriptor: {
      name: TOOL_NAME,
      title: "Validate tool registry entry",
      description: "Validate whether one TEST MCP tool is currently present in the loaded runtime registry and readable through the registry model.",
      inputSchema: TOOL_NAME_INPUT_SCHEMA,
      outputSchema: TOOL_REGISTRY_VALIDATE_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_REGISTRY_ANNOTATIONS,
    },
    async execute(args = {}) {
      try {
        const entry = validateRegistryEntry(getRuntimeRegistryContext, args.tool, { label: "tool_registry_validate_tool" });
        return {
          success: true,
          error: "",
          status: entry.status,
          connector_safe: true,
          dispatch_enabled: false,
          registry_id: entry.registry_id,
          tool: String(args.tool || ""),
          found: entry.found,
          enabled: entry.enabled,
          allowed: entry.allowed,
          reason: entry.reason,
          metadata: entry.metadata,
        };
      } catch (error) {
        return { success: false, error: error?.message || String(error), status: "error", connector_safe: true, dispatch_enabled: false, registry_id: "", tool: String(args.tool || ""), found: false, enabled: false, allowed: false, reason: "validation_error", metadata: null };
      }
    },
    summarizeArgs(args = {}) { return { tool: String(args.tool || "") }; },
    resultStats(payload = {}) { return { result_count: payload.found ? 1 : 0, result_chars: JSON.stringify(payload || {}).length }; },
  };
}

module.exports = { createToolRegistryValidateTool };
