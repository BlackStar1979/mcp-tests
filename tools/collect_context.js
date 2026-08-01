const {
  COLLECT_CONTEXT_INPUT_SCHEMA,
  COLLECT_CONTEXT_OUTPUT_SCHEMA,
  READ_ONLY_WORKSPACE_INDEX_ANNOTATIONS,
} = require("../src/schemas/workspace_index_tools");
const { collectContext, retrievalErrorMetadata } = require("../src/util/workspace_index");

const TOOL_NAME = "collect_context";

const collectContextTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Collect workspace context",
    description: "Collect bounded text context with source-freshness metadata without writing or analyzing beyond retrieval assembly.",
    inputSchema: COLLECT_CONTEXT_INPUT_SCHEMA,
    outputSchema: COLLECT_CONTEXT_OUTPUT_SCHEMA,
    annotations: READ_ONLY_WORKSPACE_INDEX_ANNOTATIONS,
  },
  async execute(args = {}) {
    try {
      return await collectContext(args.query, { limit: args.limit, maxCharsPerFile: args.max_chars_per_file, path: args.path });
    } catch (error) {
      return {
        success: false,
        error: error?.message || String(error),
        status: "error",
        query: String(args.query || ""),
        ...retrievalErrorMetadata(args.path),
        files: [],
      };
    }
  },
  summarizeArgs(args = {}) { return { query_length_chars: String(args.query || "").length, limit: Number(args.limit || 8), path: String(args.path || ".") }; },
  resultStats(payload = {}) { return { result_count: Array.isArray(payload.files) ? payload.files.length : 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { collectContextTool };
