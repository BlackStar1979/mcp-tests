"use strict";

const {
  DESTRUCTIVE_WORKSPACE_MUTATION_ANNOTATIONS,
  MOVE_PATH_INPUT_SCHEMA,
  MOVE_PATH_OUTPUT_SCHEMA,
} = require("../src/schemas/workspace_mutation_tools");
const { movePath } = require("../src/util/workspace_mutation");

const TOOL_NAME = "move_path";

const movePathTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Move workspace path",
    description: "Move or rename a file or directory inside configured workspace roots.",
    inputSchema: MOVE_PATH_INPUT_SCHEMA,
    outputSchema: MOVE_PATH_OUTPUT_SCHEMA,
    annotations: DESTRUCTIVE_WORKSPACE_MUTATION_ANNOTATIONS,
  },
  execute(args = {}) {
    return movePath(args.from, args.to, { allowProtected: args.allow_protected === true });
  },
  summarizeArgs(args = {}) {
    return {
      from_length_chars: String(args.from || "").length,
      to_length_chars: String(args.to || "").length,
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: payload.status === "moved" ? 1 : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = { movePathTool };
