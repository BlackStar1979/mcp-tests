"use strict";

const {
  STATE_CHANGING_WORKSPACE_MUTATION_ANNOTATIONS,
  APPEND_FILE_INPUT_SCHEMA,
  APPEND_FILE_OUTPUT_SCHEMA,
} = require("../src/schemas/workspace_mutation_tools");
const { appendFile } = require("../src/util/workspace_mutation");

const TOOL_NAME = "append_file";

const appendFileTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Append workspace file",
    description: "Append UTF-8 text to a file inside configured workspace roots with backup-before-append discipline.",
    inputSchema: APPEND_FILE_INPUT_SCHEMA,
    outputSchema: APPEND_FILE_OUTPUT_SCHEMA,
    annotations: STATE_CHANGING_WORKSPACE_MUTATION_ANNOTATIONS,
  },
  execute(args = {}) {
    return appendFile(args.path, args.content, { allowProtected: args.allow_protected === true });
  },
  summarizeArgs(args = {}) {
    return {
      path_length_chars: String(args.path || "").length,
      content_chars: String(args.content || "").length,
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: payload.status === "appended" ? 1 : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = { appendFileTool };
