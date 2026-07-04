const {
  COLLECT_ROMIONSIM_CONTEXT_INPUT_SCHEMA,
  COLLECT_ROMIONSIM_CONTEXT_OUTPUT_SCHEMA,
  READ_ONLY_WORKSPACE_INDEX_ANNOTATIONS,
} = require("../src/schemas/workspace_index_tools");
const { collectRomionsimContext } = require("../src/util/workspace_index");

const TOOL_NAME = "collect_romionsim_context";

const collectRomionsimContextTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Collect romionsim context",
    description: "Collect retrieval-only context from romionsim-scoped documents in the local workspace index.",
    inputSchema: COLLECT_ROMIONSIM_CONTEXT_INPUT_SCHEMA,
    outputSchema: COLLECT_ROMIONSIM_CONTEXT_OUTPUT_SCHEMA,
    annotations: READ_ONLY_WORKSPACE_INDEX_ANNOTATIONS,
  },
  async execute(args = {}) {
    try {
      return await collectRomionsimContext(args.query, { limit: args.limit, includePinned: args.include_pinned !== false });
    } catch (error) {
      return { success: false, error: error?.message || String(error), status: "error", query: String(args.query || ""), scope: "romionsim/", mode: "retrieval_helper_only", count: 0, files: [] };
    }
  },
  summarizeArgs(args = {}) { return { query_length_chars: String(args.query || "").length, limit: Number(args.limit || 12), include_pinned: args.include_pinned !== false }; },
  resultStats(payload = {}) { return { result_count: Array.isArray(payload.files) ? payload.files.length : 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { collectRomionsimContextTool };
