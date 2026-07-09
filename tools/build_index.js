"use strict";

const {
  BUILD_INDEX_INPUT_SCHEMA,
  BUILD_INDEX_OUTPUT_SCHEMA,
  STATE_CHANGING_WORKSPACE_INDEX_ANNOTATIONS,
} = require("../src/schemas/workspace_index_tools");
const { buildWorkspaceIndex } = require("../src/util/workspace_index");

const TOOL_NAME = "build_index";

const buildIndexTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Build workspace index",
    description: "Rebuild the local workspace retrieval index across configured roots.",
    inputSchema: BUILD_INDEX_INPUT_SCHEMA,
    outputSchema: BUILD_INDEX_OUTPUT_SCHEMA,
    annotations: STATE_CHANGING_WORKSPACE_INDEX_ANNOTATIONS,
  },
  async execute(args = {}) {
    try {
      const index = await buildWorkspaceIndex({
        max_files: args.max_files,
        max_dirs: args.max_dirs,
      });
      return {
        success: true,
        error: "",
        status: "built",
        count: Array.isArray(index.docs) ? index.docs.length : 0,
        created_at: String(index.created_at || ""),
        roots: Array.isArray(index.roots) ? index.roots : [],
        visited_files: Number(index.stats?.visited_files || 0),
        visited_dirs: Number(index.stats?.visited_dirs || 0),
        truncated: Boolean(index.stats?.truncated),
        skipped: index.stats?.skipped || { oversized: 0, extension: 0, directories: 0 },
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || String(error),
        status: "error",
        count: 0,
        created_at: "",
        roots: [],
        visited_files: 0,
        visited_dirs: 0,
        truncated: false,
        skipped: { oversized: 0, extension: 0, directories: 0 },
      };
    }
  },
  summarizeArgs(args = {}) {
    return {
      operation: TOOL_NAME,
      max_files: Number(args.max_files || 20000),
      max_dirs: Number(args.max_dirs || 5000),
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: Number(payload.count || 0),
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = { buildIndexTool };
