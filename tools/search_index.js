const {
  READ_ONLY_WORKSPACE_INDEX_ANNOTATIONS,
  SEARCH_INDEX_INPUT_SCHEMA,
  SEARCH_INDEX_OUTPUT_SCHEMA,
} = require("../src/schemas/workspace_index_tools");
const { retrievalErrorMetadata, searchIndex } = require("../src/util/workspace_index");

const TOOL_NAME = "search_index";

const searchIndexTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Search workspace index",
    description: "Search the local workspace index and return bounded scored snippets.",
    inputSchema: SEARCH_INDEX_INPUT_SCHEMA,
    outputSchema: SEARCH_INDEX_OUTPUT_SCHEMA,
    annotations: READ_ONLY_WORKSPACE_INDEX_ANNOTATIONS,
  },
  async execute(args = {}) {
    try {
      return await searchIndex(args.query, { limit: args.limit, path: args.path });
    } catch (error) {
      return {
        success: false,
        error: error?.message || String(error),
        status: "error",
        query: String(args.query || ""),
        ...retrievalErrorMetadata(args.path),
        results: [],
      };
    }
  },
  summarizeArgs(args = {}) { return { query_length_chars: String(args.query || "").length, limit: Number(args.limit || 10), path: String(args.path || ".") }; },
  resultStats(payload = {}) { return { result_count: Array.isArray(payload.results) ? payload.results.length : 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { searchIndexTool };
