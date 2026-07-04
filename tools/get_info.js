const {
  READ_ONLY_WORKSPACE_FS_ANNOTATIONS,
  WORKSPACE_GET_INFO_OUTPUT_SCHEMA,
  WORKSPACE_PATH_INPUT_SCHEMA,
} = require("../src/schemas/workspace_fs_tools");
const { fileInfoFor, summarizeWorkspacePath } = require("../src/util/workspace_fs");

const TOOL_NAME = "get_info";

async function execute(args = {}) {
  try {
    return { success: true, error: "", ...(await fileInfoFor(args.path)) };
  } catch (error) {
    return {
      success: false,
      path: String(args.path || ""),
      type: "file",
      size: 0,
      created: "",
      modified: "",
      root_alias: "",
      error: error?.message || String(error),
    };
  }
}

const getInfoTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Get workspace file or directory info",
    description: "Read-only metadata for a file or folder inside configured workspace roots.",
    inputSchema: WORKSPACE_PATH_INPUT_SCHEMA,
    outputSchema: WORKSPACE_GET_INFO_OUTPUT_SCHEMA,
    annotations: READ_ONLY_WORKSPACE_FS_ANNOTATIONS,
  },
  execute,
  summarizeArgs: summarizeWorkspacePath,
  resultStats(payload = {}) {
    return {
      result_count: payload.success ? 1 : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = {
  getInfoTool,
};
