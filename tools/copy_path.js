"use strict";

const {
  STATE_CHANGING_WORKSPACE_MUTATION_ANNOTATIONS,
  COPY_PATH_INPUT_SCHEMA,
  COPY_PATH_OUTPUT_SCHEMA,
} = require("../src/schemas/workspace_mutation_tools");
const { copyPath } = require("../src/util/workspace_mutation");

const TOOL_NAME = "copy_path";

const copyPathTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Copy workspace path",
    description: "Copy a file or directory inside configured workspace roots.",
    inputSchema: COPY_PATH_INPUT_SCHEMA,
    outputSchema: COPY_PATH_OUTPUT_SCHEMA,
    annotations: STATE_CHANGING_WORKSPACE_MUTATION_ANNOTATIONS,
  },
  execute(args = {}) {
    return copyPath(args.from, args.to, { allowProtected: args.allow_protected === true });
  },
  summarizeArgs(args = {}) {
    return {
      from_length_chars: String(args.from || "").length,
      to_length_chars: String(args.to || "").length,
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: payload.status === "copied" ? 1 : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = { copyPathTool };
