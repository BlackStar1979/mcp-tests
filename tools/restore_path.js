"use strict";

const {
  DESTRUCTIVE_WORKSPACE_MUTATION_ANNOTATIONS,
  RESTORE_PATH_INPUT_SCHEMA,
  RESTORE_PATH_OUTPUT_SCHEMA,
} = require("../src/schemas/workspace_mutation_tools");
const { restorePath } = require("../src/util/workspace_mutation");

const TOOL_NAME = "restore_path";

const restorePathTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Restore workspace path",
    description: "Restore a previously soft-deleted path from .mcp_trash.",
    inputSchema: RESTORE_PATH_INPUT_SCHEMA,
    outputSchema: RESTORE_PATH_OUTPUT_SCHEMA,
    annotations: DESTRUCTIVE_WORKSPACE_MUTATION_ANNOTATIONS,
  },
  execute(args = {}) {
    return restorePath(args.trash_path, {
      destination: args.destination,
      overwrite: args.overwrite === true,
      allowProtected: args.allow_protected === true,
    });
  },
  summarizeArgs(args = {}) {
    return {
      trash_path_length_chars: String(args.trash_path || "").length,
      destination_length_chars: String(args.destination || "").length,
      overwrite: args.overwrite === true,
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: payload.status === "restored" ? 1 : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = { restorePathTool };
