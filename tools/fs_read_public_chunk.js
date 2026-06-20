const { FS_READ_CHUNK_INPUT_SCHEMA, FS_READ_OUTPUT_SCHEMA, READ_ONLY_FS_ANNOTATIONS } = require("../src/schemas/fs_tools");
const { readPublicChunk, safeArgSummary } = require("../src/util/path_policy");

const TOOL_NAME = "fs_read_public_chunk";

async function execute(args = {}) {
  try {
    const payload = await readPublicChunk(args.path, {
      offset: args.offset,
      length: args.length,
    });
    return { success: true, error: "", ...payload };
  } catch (error) {
    return { success: false, path: String(args.path || ""), size_bytes: 0, chars: 0, truncated: false, sha256: "", text: "", error: error?.message || String(error) };
  }
}

const fsReadPublicChunkTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Read public FS text chunk",
    description: "Read a bounded character chunk from a UTF-8 text file inside the public filesystem sandbox only.",
    inputSchema: FS_READ_CHUNK_INPUT_SCHEMA,
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

module.exports = { fsReadPublicChunkTool };
