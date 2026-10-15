const {
  READ_ONLY_WORKSPACE_FS_ANNOTATIONS,
  WORKSPACE_READ_CHUNK_INPUT_SCHEMA,
  WORKSPACE_READ_CHUNK_OUTPUT_SCHEMA,
} = require("../src/schemas/workspace_fs_tools");
const { readFileChunk, summarizeWorkspacePath } = require("../src/util/workspace_fs");

const TOOL_NAME = "read_file_chunk";

async function execute(args = {}) {
  try {
    return {
      success: true,
      error: "",
      ...(await readFileChunk(args.path, {
        offset: args.offset,
        length: args.length,
      })),
    };
  } catch (error) {
    return {
      success: false,
      path: String(args.path || ""),
      root_alias: "",
      bytes: 0,
      chars: null,
      offset: Number(args.offset) || 0,
      length: Number(args.length) || 50000,
      returned_chars: 0,
      next_offset: Number(args.offset) || 0,
      has_more: false,
      complete: false,
      scanned_chars: 0,
      text: "",
      error: error?.message || String(error),
    };
  }
}

const readFileChunkTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Read workspace file chunk",
    description: "Read a bounded character chunk and stop after one probe character beyond the requested range.",
    inputSchema: WORKSPACE_READ_CHUNK_INPUT_SCHEMA,
    outputSchema: WORKSPACE_READ_CHUNK_OUTPUT_SCHEMA,
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
  readFileChunkTool,
};
