const {
  EMPTY_INPUT_SCHEMA,
  READ_ONLY_TRUTH_ANNOTATIONS,
  TOOL_USAGE_SNAPSHOT_OUTPUT_SCHEMA,
} = require("../src/schemas/truth_tools");
const { buildToolUsageSnapshot } = require("../src/truth/tool_usage_snapshot");

const TOOL_NAME = "tool_usage_snapshot";

async function execute() {
  return buildToolUsageSnapshot();
}

const toolUsageSnapshotTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Tool usage snapshot",
    description: "Read-only summary of recent local MCP tool usage derived from the shared TEST MCP audit log.",
    inputSchema: EMPTY_INPUT_SCHEMA,
    outputSchema: TOOL_USAGE_SNAPSHOT_OUTPUT_SCHEMA,
    annotations: READ_ONLY_TRUTH_ANNOTATIONS,
  },
  execute,
  summarizeArgs() {
    return { operation: TOOL_NAME };
  },
  resultStats(payload = {}) {
    return {
      result_count: Array.isArray(payload.top_tools) ? payload.top_tools.length : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = {
  toolUsageSnapshotTool,
};
