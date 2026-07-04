const {
  READ_ONLY_WORKSPACE_FS_ANNOTATIONS,
  WORKSPACE_READ_LINES_INPUT_SCHEMA,
  WORKSPACE_READ_LINES_OUTPUT_SCHEMA,
} = require("../src/schemas/workspace_fs_tools");
const { readFileLines, summarizeWorkspacePath } = require("../src/util/workspace_fs");

const TOOL_NAME = "read_file_lines";

async function execute(args = {}) {
  try {
    return {
      success: true,
      error: "",
      ...(await readFileLines(args.path, {
        startLine: args.start_line,
        endLine: args.end_line,
        includeLineNumbers: args.include_line_numbers,
        maxChars: args.max_chars,
      })),
    };
  } catch (error) {
    return {
      success: false,
      path: String(args.path || ""),
      root_alias: "",
      bytes: 0,
      start_line: Number(args.start_line) || 1,
      end_line: Number(args.end_line) || 1,
      effective_start_line: Number(args.start_line) || 1,
      effective_end_line: null,
      total_lines: 0,
      returned_lines: 0,
      include_line_numbers: args.include_line_numbers !== false,
      returned_chars: 0,
      truncated: false,
      text: "",
      lines: [],
      error: error?.message || String(error),
    };
  }
}

const readFileLinesTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Read workspace file lines",
    description: "Read a bounded 1-based line range from a UTF-8 file inside configured workspace roots.",
    inputSchema: WORKSPACE_READ_LINES_INPUT_SCHEMA,
    outputSchema: WORKSPACE_READ_LINES_OUTPUT_SCHEMA,
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
  readFileLinesTool,
};
