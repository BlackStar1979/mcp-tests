"use strict";

const {
  DESTRUCTIVE_WORKSPACE_MUTATION_ANNOTATIONS,
  WRITE_FILE_INPUT_SCHEMA,
  WRITE_FILE_OUTPUT_SCHEMA,
} = require("../src/schemas/workspace_mutation_tools");
const { writeFile } = require("../src/util/workspace_mutation");

const TOOL_NAME = "write_file";

const writeFileTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Write workspace file",
    description: "Create or overwrite a UTF-8 file inside configured workspace roots with backup-before-overwrite discipline.",
    inputSchema: WRITE_FILE_INPUT_SCHEMA,
    outputSchema: WRITE_FILE_OUTPUT_SCHEMA,
    annotations: DESTRUCTIVE_WORKSPACE_MUTATION_ANNOTATIONS,
  },
  execute(args = {}) {
    return writeFile(args.path, args.content, { allowProtected: args.allow_protected === true });
  },
  summarizeArgs(args = {}) {
    return {
      path_length_chars: String(args.path || "").length,
      content_chars: String(args.content || "").length,
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: payload.status === "written" ? 1 : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = { writeFileTool };
