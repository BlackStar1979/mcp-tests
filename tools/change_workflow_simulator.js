const {
  CHANGE_GUARD_INPUT_SCHEMA,
  CHANGE_WORKFLOW_SIMULATOR_OUTPUT_SCHEMA,
  READ_ONLY_TRUTH_ANNOTATIONS,
} = require("../src/schemas/truth_tools");
const { simulateChangeWorkflow } = require("../src/truth/change_workflow_simulator");

const TOOL_NAME = "change_workflow_simulator";

async function execute(args = {}) {
  return simulateChangeWorkflow(args.changed_paths, args);
}

const changeWorkflowSimulatorTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Change workflow simulator",
    description: "Simulate the minimal repo/runtime validation flow for a planned change without executing it.",
    inputSchema: CHANGE_GUARD_INPUT_SCHEMA,
    outputSchema: CHANGE_WORKFLOW_SIMULATOR_OUTPUT_SCHEMA,
    annotations: READ_ONLY_TRUTH_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) {
    return {
      operation: TOOL_NAME,
      changed_path_count: Array.isArray(args.changed_paths) ? args.changed_paths.length : 0,
      descriptor_change: Boolean(args.descriptor_change),
      schema_change: Boolean(args.schema_change),
      tool_surface_change: Boolean(args.tool_surface_change),
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: Array.isArray(payload.workflow) ? payload.workflow.length : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = {
  changeWorkflowSimulatorTool,
};
