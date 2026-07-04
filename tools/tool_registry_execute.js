const {
  READ_ONLY_TOOL_REGISTRY_ANNOTATIONS,
  TOOL_EXECUTE_INPUT_SCHEMA,
  TOOL_REGISTRY_EXECUTE_OUTPUT_SCHEMA,
} = require("../src/schemas/tool_registry_tools");
const { executeRegistryOperationDryRun } = require("../src/tool_registry_runtime");

const TOOL_NAME = "tool_registry_execute";

function createToolRegistryExecuteTool(getRuntimeRegistryContext) {
  return {
    name: TOOL_NAME,
    descriptor: {
      name: TOOL_NAME,
      title: "Tool registry execute dry-run",
      description: "Simulate a registry operation in read-only dry-run mode without dispatching or mutating any TEST MCP tool.",
      inputSchema: TOOL_EXECUTE_INPUT_SCHEMA,
      outputSchema: TOOL_REGISTRY_EXECUTE_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_REGISTRY_ANNOTATIONS,
    },
    async execute(args = {}) {
      try {
        return executeRegistryOperationDryRun(getRuntimeRegistryContext, args.tool, args.operation, args.execution_mode, { label: "tool_registry_execute" });
      } catch (error) {
        return { success: false, error: error?.message || String(error), status: "error", connector_safe: true, dispatch_enabled: false, execution_enabled: false, simulated_execution: true, execution_mode: "simulation", execution_id: "", plan_hash: "", registry_id: "", tool: String(args.tool || ""), operation: String(args.operation || ""), found: false, enabled: false, allowed: false, plan_ready: false, reason: "execute_error", steps_count: 0, simulated_steps: [] };
      }
    },
    summarizeArgs(args = {}) { return { tool: String(args.tool || ""), operation: String(args.operation || ""), execution_mode: "simulation" }; },
    resultStats(payload = {}) { return { result_count: Number(payload.steps_count || 0), result_chars: JSON.stringify(payload || {}).length }; },
  };
}

module.exports = { createToolRegistryExecuteTool };
