"use strict";

const {
  DESTRUCTIVE_WORKSPACE_MUTATION_ANNOTATIONS,
  DELETE_PATH_INPUT_SCHEMA,
  DELETE_PATH_OUTPUT_SCHEMA,
} = require("../src/schemas/workspace_mutation_tools");
const { deletePath } = require("../src/util/workspace_mutation");

const TOOL_NAME = "delete_path";

const deletePathTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Delete workspace path",
    description: "Soft-delete a file or directory inside configured workspace roots by moving it into .mcp_trash with restore metadata.",
    inputSchema: DELETE_PATH_INPUT_SCHEMA,
    outputSchema: DELETE_PATH_OUTPUT_SCHEMA,
    annotations: DESTRUCTIVE_WORKSPACE_MUTATION_ANNOTATIONS,
  },
  execute(args = {}) {
    return deletePath(args.path, { allowProtected: args.allow_protected === true });
  },
  summarizeArgs(args = {}) {
    return {
      path_length_chars: String(args.path || "").length,
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: payload.status === "moved_to_trash" ? 1 : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = { deletePathTool };
