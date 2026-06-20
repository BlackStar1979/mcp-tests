const { DEV_CODE_GRAPH_INPUT_SCHEMA, DEV_CODE_DEPENDENCIES_OUTPUT_SCHEMA, READ_ONLY_DEV_ANNOTATIONS } = require("../src/schemas/dev_tools");
const { buildDependencyGraph } = require("../src/util/code_workspace");
const { safeArgSummary } = require("../src/util/path_policy");

const TOOL_NAME = "dev_code_dependencies";

async function execute(args = {}) {
  try {
    const payload = await buildDependencyGraph(args.path, {
      recursive: args.recursive !== false,
      maxFiles: args.max_files || 500,
    });
    return { success: true, error: "", ...payload };
  } catch (error) {
    return { success: false, path: String(args.path || ""), recursive: args.recursive !== false, max_files: args.max_files || 500, visited_files: 0, scanned_files: 0, truncated: false, nodes_count: 0, edges_count: 0, unresolved_count: 0, nodes: [], edges: [], unresolved: [], error: error?.message || String(error) };
  }
}

const devCodeDependenciesTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Build developer dependency graph",
    description: "Read-only bounded JS/TS/Python import dependency graph for TEST MCP workspace files.",
    inputSchema: DEV_CODE_GRAPH_INPUT_SCHEMA,
    outputSchema: DEV_CODE_DEPENDENCIES_OUTPUT_SCHEMA,
    annotations: READ_ONLY_DEV_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) { return safeArgSummary(args.path || ""); },
  resultStats(payload = {}) { return { result_count: payload.nodes_count || 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { devCodeDependenciesTool };
