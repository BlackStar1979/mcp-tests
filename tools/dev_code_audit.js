const { DEV_CODE_AUDIT_INPUT_SCHEMA, DEV_CODE_AUDIT_OUTPUT_SCHEMA, READ_ONLY_DEV_ANNOTATIONS } = require("../src/schemas/dev_tools");
const { auditGraph, buildDependencyGraph } = require("../src/util/code_workspace");
const { safeArgSummary } = require("../src/util/path_policy");

const TOOL_NAME = "dev_code_audit";

async function execute(args = {}) {
  try {
    const graph = await buildDependencyGraph(args.path, {
      recursive: args.recursive !== false,
      maxFiles: args.max_files || 500,
    });
    return { success: true, error: "", ...auditGraph(graph, args.top_n || 20) };
  } catch (error) {
    return { success: false, path: String(args.path || ""), recursive: args.recursive !== false, max_files: args.max_files || 500, summary: { nodes: 0, edges: 0, unresolved: 0, truncated: false }, high_fan_in: [], high_fan_out: [], unresolved: [], error: error?.message || String(error) };
  }
}

const devCodeAuditTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Audit developer code graph",
    description: "Read-only fan-in/fan-out and unresolved import audit for bounded TEST MCP workspace code graph.",
    inputSchema: DEV_CODE_AUDIT_INPUT_SCHEMA,
    outputSchema: DEV_CODE_AUDIT_OUTPUT_SCHEMA,
    annotations: READ_ONLY_DEV_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) { return safeArgSummary(args.path || ""); },
  resultStats(payload = {}) { return { result_count: payload.summary?.nodes || 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { devCodeAuditTool };
