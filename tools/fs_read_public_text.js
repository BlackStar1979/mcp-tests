const { FS_READ_TEXT_INPUT_SCHEMA, FS_READ_OUTPUT_SCHEMA, READ_ONLY_FS_ANNOTATIONS } = require("../src/schemas/fs_tools");
const { readBoundedText, safeArgSummary } = require("../src/util/path_policy");

const TOOL_NAME = "fs_read_public_text";

async function execute(args = {}) {
  try {
    return { success: true, error: "", ...(await readBoundedText(args.path, { maxChars: args.max_chars })) };
  } catch (error) {
    return { success: false, path: String(args.path || ""), size_bytes: 0, chars: 0, truncated: false, sha256: "", text: "", error: error?.message || String(error) };
  }
}

const fsReadPublicTextTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Read public FS text file",
    description: "Read one bounded UTF-8 text file inside the TEST MCP public filesystem sandbox only.",
    inputSchema: FS_READ_TEXT_INPUT_SCHEMA,
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

module.exports = { fsReadPublicTextTool };
