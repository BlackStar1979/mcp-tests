const { DEV_CODE_IMPACT_INPUT_SCHEMA, DEV_CODE_IMPACT_OUTPUT_SCHEMA, READ_ONLY_DEV_ANNOTATIONS } = require("../src/schemas/dev_tools");
const { buildDependencyGraph, impactGraph } = require("../src/util/code_workspace");
const { safeArgSummary } = require("../src/util/path_policy");

const TOOL_NAME = "dev_code_impact";

async function execute(args = {}) {
  try {
    const graph = await buildDependencyGraph(args.path, {
      recursive: args.recursive !== false,
      maxFiles: args.max_files || 500,
    });
    const result = impactGraph(graph, args.target, args.direction || "both", args.max_depth || 5);
    return { success: true, error: "", scope: graph.path, direction: args.direction || "both", max_depth: args.max_depth || 5, graph: { nodes: graph.nodes_count, edges: graph.edges_count, truncated: graph.truncated }, ...result };
  } catch (error) {
    return { success: false, scope: String(args.path || ""), direction: args.direction || "both", max_depth: args.max_depth || 5, graph: { nodes: 0, edges: 0, truncated: false }, target: String(args.target || ""), found: false, affected_count: 0, dependencies_count: 0, affected: [], dependencies: [], error: error?.message || String(error) };
  }
}

const devCodeImpactTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Analyze developer code impact",
    description: "Read-only dependents/dependencies trace for one file inside a bounded TEST MCP workspace code graph.",
    inputSchema: DEV_CODE_IMPACT_INPUT_SCHEMA,
    outputSchema: DEV_CODE_IMPACT_OUTPUT_SCHEMA,
    annotations: READ_ONLY_DEV_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) { return safeArgSummary(args.path || ""); },
  resultStats(payload = {}) { return { result_count: (payload.affected_count || 0) + (payload.dependencies_count || 0), result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { devCodeImpactTool };
