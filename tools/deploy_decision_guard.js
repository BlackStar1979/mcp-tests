const {
  CHANGE_GUARD_INPUT_SCHEMA,
  CHANGE_GUARD_OUTPUT_SCHEMA,
  READ_ONLY_TRUTH_ANNOTATIONS,
} = require("../src/schemas/truth_tools");
const { buildDeployDecisionGuard } = require("../src/truth/change_workflow_simulator");

const TOOL_NAME = "deploy_decision_guard";

async function execute(args = {}) {
  return buildDeployDecisionGuard(args.changed_paths, args);
}

const deployDecisionGuardTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Deploy decision guard",
    description: "Classify a planned change and return whether restart, connector refresh, or explicit operator approval is required.",
    inputSchema: CHANGE_GUARD_INPUT_SCHEMA,
    outputSchema: CHANGE_GUARD_OUTPUT_SCHEMA,
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
  deployDecisionGuardTool,
};
