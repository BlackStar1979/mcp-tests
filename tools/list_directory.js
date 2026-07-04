const {
  READ_ONLY_WORKSPACE_FS_ANNOTATIONS,
  WORKSPACE_LIST_DIRECTORY_OUTPUT_SCHEMA,
  WORKSPACE_LIST_INPUT_SCHEMA,
} = require("../src/schemas/workspace_fs_tools");
const { listDirectory, summarizeWorkspacePath } = require("../src/util/workspace_fs");

const TOOL_NAME = "list_directory";

async function execute(args = {}) {
  try {
    return { success: true, error: "", ...(await listDirectory(args.path || ".")) };
  } catch (error) {
    return {
      success: false,
      path: String(args.path || "."),
      root_alias: "",
      count: 0,
      entries: [],
      error: error?.message || String(error),
    };
  }
}

const listDirectoryTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "List workspace directory",
    description: "Read-only directory listing inside configured workspace roots.",
    inputSchema: WORKSPACE_LIST_INPUT_SCHEMA,
    outputSchema: WORKSPACE_LIST_DIRECTORY_OUTPUT_SCHEMA,
    annotations: READ_ONLY_WORKSPACE_FS_ANNOTATIONS,
  },
  execute,
  summarizeArgs: summarizeWorkspacePath,
  resultStats(payload = {}) {
    return {
      result_count: Array.isArray(payload.entries) ? payload.entries.length : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = {
  listDirectoryTool,
};
