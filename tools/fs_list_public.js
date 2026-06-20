const { FS_LIST_INPUT_SCHEMA, FS_LIST_OUTPUT_SCHEMA, READ_ONLY_FS_ANNOTATIONS } = require("../src/schemas/fs_tools");
const { listPublicDirectory, safeArgSummary } = require("../src/util/path_policy");

const TOOL_NAME = "fs_list_public";

async function execute(args = {}) {
  try {
    const payload = listPublicDirectory(args.path || ".", { maxEntries: args.max_entries });
    return { success: true, error: "", ...payload };
  } catch (error) {
    return { success: false, root: "", path: String(args.path || "."), entries: [], truncated: false, error: error?.message || String(error) };
  }
}

const fsListPublicTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "List public FS sandbox",
    description: "Read-only directory listing inside the TEST MCP public filesystem sandbox only.",
    inputSchema: FS_LIST_INPUT_SCHEMA,
    outputSchema: FS_LIST_OUTPUT_SCHEMA,
    annotations: READ_ONLY_FS_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) {
    return safeArgSummary(args.path || ".");
  },
  resultStats(payload = {}) {
    return { result_count: Array.isArray(payload.entries) ? payload.entries.length : 0, result_chars: JSON.stringify(payload || {}).length };
  },
};

module.exports = { fsListPublicTool };
