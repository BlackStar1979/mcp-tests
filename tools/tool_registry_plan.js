const {
  READ_ONLY_TOOL_REGISTRY_ANNOTATIONS,
  TOOL_OPERATION_INPUT_SCHEMA,
  TOOL_REGISTRY_PLAN_OUTPUT_SCHEMA,
} = require("../src/schemas/tool_registry_tools");
const { planRegistryOperation } = require("../src/tool_registry_runtime");

const TOOL_NAME = "tool_registry_plan";

function createToolRegistryPlanTool(getRuntimeRegistryContext) {
  return {
    name: TOOL_NAME,
    descriptor: {
      name: TOOL_NAME,
      title: "Tool registry plan",
      description: "Return a deterministic read-only plan for a requested operation against one currently loaded TEST MCP tool.",
      inputSchema: TOOL_OPERATION_INPUT_SCHEMA,
      outputSchema: TOOL_REGISTRY_PLAN_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_REGISTRY_ANNOTATIONS,
    },
    async execute(args = {}) {
      try {
        return planRegistryOperation(getRuntimeRegistryContext, args.tool, args.operation, { label: "tool_registry_plan" });
      } catch (error) {
        return { success: false, error: error?.message || String(error), status: "error", connector_safe: true, dispatch_enabled: false, execution_enabled: false, registry_id: "", tool: String(args.tool || ""), operation: String(args.operation || ""), found: false, enabled: false, allowed: false, plan_ready: false, reason: "plan_error", steps: [] };
      }
    },
    summarizeArgs(args = {}) { return { tool: String(args.tool || ""), operation: String(args.operation || "") }; },
    resultStats(payload = {}) { return { result_count: Array.isArray(payload.steps) ? payload.steps.length : 0, result_chars: JSON.stringify(payload || {}).length }; },
  };
}

module.exports = { createToolRegistryPlanTool };
