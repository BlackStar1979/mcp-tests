const {
  DEV_CODE_PATCH_PLAN_INPUT_SCHEMA,
  DEV_CODE_PATCH_PLAN_OUTPUT_SCHEMA,
  READ_ONLY_DEV_ANNOTATIONS,
} = require("../src/schemas/dev_tools");
const { buildDependencyGraph, patchPlan } = require("../src/util/code_workspace");
const { safeArgSummary } = require("../src/util/path_policy");

const TOOL_NAME = "code_patch_plan";

async function execute(args = {}) {
  try {
    const graph = await buildDependencyGraph(args.path, {
      recursive: args.recursive !== false,
      maxFiles: args.max_files || 500,
    });
    const result = patchPlan(
      graph,
      args.target,
      args.intent || "refactor",
      args.objective || "",
      args.direction || "both",
      args.max_depth || 5,
    );
    return {
      success: true,
      error: "",
      scope: graph.path,
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
      direction: args.direction || "both",
      max_depth: args.max_depth || 5,
      graph: { nodes: 0, edges: 0, truncated: false },
      intent: args.intent || "refactor",
      objective: String(args.objective || ""),
      change_type: "",
      scenario: { found: false, target: String(args.target || ""), affected_count: 0, dependencies_count: 0, affected: [], dependencies: [] },
      plan: [],
      read_plan: [],
      validation_plan: [],
      patch_constraints: [],
      decision: { status: "error", proceed: false },
    };
  }
}

const codePatchPlanTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Plan code patch",
    description: "Read-only patch planning for one workspace code target without modifying files.",
    inputSchema: DEV_CODE_PATCH_PLAN_INPUT_SCHEMA,
    outputSchema: DEV_CODE_PATCH_PLAN_OUTPUT_SCHEMA,
    annotations: READ_ONLY_DEV_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) { return safeArgSummary(args.path || ""); },
  resultStats(payload = {}) {
    return {
      result_count: Array.isArray(payload.plan) ? payload.plan.length : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = { codePatchPlanTool };
