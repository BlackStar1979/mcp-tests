const { FS_PATH_INPUT_SCHEMA, FS_INFO_OUTPUT_SCHEMA, READ_ONLY_FS_ANNOTATIONS } = require("../src/schemas/fs_tools");
const { fileInfoFor, safeArgSummary } = require("../src/util/path_policy");

const TOOL_NAME = "fs_get_public_info";

async function execute(args = {}) {
  try {
    return { success: true, error: "", ...(await fileInfoFor(args.path || ".")) };
  } catch (error) {
    return { success: false, path: String(args.path || "."), name: "", kind: "", size_bytes: 0, modified_ms: 0, sha256: "", error: error?.message || String(error) };
  }
}

const fsGetPublicInfoTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Get public FS item info",
    description: "Read-only metadata for one item inside the TEST MCP public filesystem sandbox only.",
    inputSchema: FS_PATH_INPUT_SCHEMA,
    outputSchema: FS_INFO_OUTPUT_SCHEMA,
    annotations: READ_ONLY_FS_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) {
    return safeArgSummary(args.path || ".");
  },
  resultStats(payload = {}) {
    return { result_count: payload.success ? 1 : 0, result_chars: JSON.stringify(payload || {}).length };
  },
};

module.exports = { fsGetPublicInfoTool };
