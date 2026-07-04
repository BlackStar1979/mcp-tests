const {
  READ_ONLY_TOOL_REGISTRY_ANNOTATIONS,
  TOOL_OPERATION_INPUT_SCHEMA,
  TOOL_REGISTRY_PREFLIGHT_OUTPUT_SCHEMA,
} = require("../src/schemas/tool_registry_tools");
const { preflightRegistryOperation } = require("../src/tool_registry_runtime");

const TOOL_NAME = "tool_registry_preflight";

function createToolRegistryPreflightTool(getRuntimeRegistryContext) {
  return {
    name: TOOL_NAME,
    descriptor: {
      name: TOOL_NAME,
      title: "Tool registry preflight",
      description: "Read-only preflight for a requested operation against one currently loaded TEST MCP tool.",
      inputSchema: TOOL_OPERATION_INPUT_SCHEMA,
      outputSchema: TOOL_REGISTRY_PREFLIGHT_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_REGISTRY_ANNOTATIONS,
    },
    async execute(args = {}) {
      try {
        return preflightRegistryOperation(getRuntimeRegistryContext, args.tool, args.operation, { label: "tool_registry_preflight" });
      } catch (error) {
        return { success: false, error: error?.message || String(error), status: "error", connector_safe: true, dispatch_enabled: false, registry_id: "", tool: String(args.tool || ""), operation: String(args.operation || ""), found: false, enabled: false, allowed: false, reason: "preflight_error", allowed_operations: [], tool_policy_summary: null, catalog_summary: null };
      }
    },
    summarizeArgs(args = {}) { return { tool: String(args.tool || ""), operation: String(args.operation || "") }; },
    resultStats(payload = {}) { return { result_count: payload.allowed ? 1 : 0, result_chars: JSON.stringify(payload || {}).length }; },
  };
}

module.exports = { createToolRegistryPreflightTool };
