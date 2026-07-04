const {
  READ_ONLY_WORKSPACE_FS_ANNOTATIONS,
  WORKSPACE_READ_FILE_INPUT_SCHEMA,
  WORKSPACE_READ_FILE_OUTPUT_SCHEMA,
} = require("../src/schemas/workspace_fs_tools");
const { readFile, summarizeWorkspacePath } = require("../src/util/workspace_fs");

const TOOL_NAME = "read_file";

async function execute(args = {}) {
  try {
    return { success: true, error: "", ...(await readFile(args.path, { maxChars: args.max_chars })) };
  } catch (error) {
    return {
      success: false,
      path: String(args.path || ""),
      root_alias: "",
      bytes: 0,
      chars: 0,
      returned_chars: 0,
      total_lines: 0,
      truncated: false,
      text: "",
      error: error?.message || String(error),
    };
  }
}

const readFileTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Read workspace file",
    description: "Read bounded UTF-8 file content inside configured workspace roots.",
    inputSchema: WORKSPACE_READ_FILE_INPUT_SCHEMA,
    outputSchema: WORKSPACE_READ_FILE_OUTPUT_SCHEMA,
    annotations: READ_ONLY_WORKSPACE_FS_ANNOTATIONS,
  },
  execute,
  summarizeArgs: summarizeWorkspacePath,
  resultStats(payload = {}) {
    return {
      result_count: payload.success ? 1 : 0,
      result_chars: String(payload.text || "").length,
    };
  },
};

module.exports = {
  readFileTool,
};
