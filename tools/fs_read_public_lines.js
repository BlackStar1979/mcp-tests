const { FS_READ_LINES_INPUT_SCHEMA, FS_READ_OUTPUT_SCHEMA, READ_ONLY_FS_ANNOTATIONS } = require("../src/schemas/fs_tools");
const { readPublicLines, safeArgSummary } = require("../src/util/path_policy");

const TOOL_NAME = "fs_read_public_lines";

async function execute(args = {}) {
  try {
    const payload = await readPublicLines(args.path, {
      startLine: args.start_line,
      endLine: args.end_line,
      includeLineNumbers: args.include_line_numbers,
      maxChars: args.max_chars,
    });
    return { success: true, error: "", ...payload };
  } catch (error) {
    return { success: false, path: String(args.path || ""), size_bytes: 0, chars: 0, truncated: false, sha256: "", text: "", error: error?.message || String(error) };
  }
}

const fsReadPublicLinesTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Read public FS text lines",
    description: "Read a bounded 1-based line range from a UTF-8 text file inside the public filesystem sandbox only.",
    inputSchema: FS_READ_LINES_INPUT_SCHEMA,
    outputSchema: FS_READ_OUTPUT_SCHEMA,
    annotations: READ_ONLY_FS_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) {
    return safeArgSummary(args.path || "");
  },
  resultStats(payload = {}) {
    return { result_count: payload.success ? 1 : 0, result_chars: String(payload.text || "").length };
  },
};

module.exports = { fsReadPublicLinesTool };
