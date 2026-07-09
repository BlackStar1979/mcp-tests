const {
  DEV_CODE_SCENARIO_INPUT_SCHEMA,
  DEV_CODE_SCENARIO_OUTPUT_SCHEMA,
  READ_ONLY_DEV_ANNOTATIONS,
} = require("../src/schemas/dev_tools");
const { buildDependencyGraph, scenarioPlan } = require("../src/util/code_workspace");
const { safeArgSummary } = require("../src/util/path_policy");

const TOOL_NAME = "code_scenario";

async function execute(args = {}) {
  try {
    const graph = await buildDependencyGraph(args.path, {
      recursive: args.recursive !== false,
      maxFiles: args.max_files || 500,
    });
    const result = scenarioPlan(
      graph,
      args.target,
      args.change_type || "internal_refactor",
      args.direction || "both",
      args.max_depth || 5,
    );
    return {
      success: true,
      error: "",
      scope: graph.path,
      change_type: args.change_type || "internal_refactor",
      direction: args.direction || "both",
      max_depth: args.max_depth || 5,
      graph: { nodes: graph.nodes_count, edges: graph.edges_count, truncated: graph.truncated },
      ...result,
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || String(error),
      scope: String(args.path || ""),
      change_type: args.change_type || "internal_refactor",
      direction: args.direction || "both",
      max_depth: args.max_depth || 5,
      graph: { nodes: 0, edges: 0, truncated: false },
      target: String(args.target || ""),
      found: false,
      affected_count: 0,
      dependencies_count: 0,
      affected: [],
      dependencies: [],
      context_files: [],
      recommended_checks: [],
      risk: { level: "unknown", score: 0, fan_in: 0, fan_out: 0 },
    };
  }
}

const codeScenarioTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Plan code change scenario",
    description: "Read-only impact and risk classification for a planned workspace code change.",
    inputSchema: DEV_CODE_SCENARIO_INPUT_SCHEMA,
    outputSchema: DEV_CODE_SCENARIO_OUTPUT_SCHEMA,
    annotations: READ_ONLY_DEV_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) { return safeArgSummary(args.path || ""); },
  resultStats(payload = {}) {
    return {
      result_count: (payload.affected_count || 0) + (payload.dependencies_count || 0),
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = { codeScenarioTool };
