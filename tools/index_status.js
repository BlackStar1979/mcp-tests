const {
  INDEX_STATUS_INPUT_SCHEMA,
  INDEX_STATUS_OUTPUT_SCHEMA,
  READ_ONLY_WORKSPACE_INDEX_ANNOTATIONS,
} = require("../src/schemas/workspace_index_tools");
const { indexStatus } = require("../src/util/workspace_index");

const TOOL_NAME = "index_status";

const indexStatusTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Workspace index status",
    description: "Read-only status for the local workspace index used by TEST MCP retrieval helpers.",
    inputSchema: INDEX_STATUS_INPUT_SCHEMA,
    outputSchema: INDEX_STATUS_OUTPUT_SCHEMA,
    annotations: READ_ONLY_WORKSPACE_INDEX_ANNOTATIONS,
  },
  execute() {
    return indexStatus();
  },
  summarizeArgs() { return { operation: TOOL_NAME }; },
  resultStats(payload = {}) { return { result_count: Number(payload.count || 0), result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { indexStatusTool };
