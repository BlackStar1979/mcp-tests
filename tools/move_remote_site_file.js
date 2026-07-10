"use strict";

const {
  MOVE_REMOTE_SITE_FILE_INPUT_SCHEMA,
  MOVE_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
  REMOTE_SITE_MUTATION_ANNOTATIONS,
} = require("../src/schemas/remote_site_tools");
const {
  countJsonChars,
  moveRemoteSiteFile,
} = require("../src/util/remote_site_tools");

const TOOL_NAME = "move_remote_site_file";

async function execute(args = {}) {
  try {
    const result = await moveRemoteSiteFile(args);
    return { success: true, error: "", ...result };
  } catch (error) {
    return {
      success: false,
      status: "error",
      source_path: typeof args.source_path === "string" ? args.source_path : "",
      target_path: typeof args.target_path === "string" ? args.target_path : "",
      error: error?.message || String(error),
    };
  }
}

const moveRemoteSiteFileTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Move remote site file",
    description: "Move a bounded remote-site file inside the configured webroot without overwrite.",
    inputSchema: MOVE_REMOTE_SITE_FILE_INPUT_SCHEMA,
    outputSchema: MOVE_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
    annotations: REMOTE_SITE_MUTATION_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) {
    return {
      has_config_ref: Boolean(args.vps_config_ref),
      source_path: typeof args.source_path === "string" ? args.source_path : "",
      target_path: typeof args.target_path === "string" ? args.target_path : "",
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: payload.success ? 1 : 0,
      result_chars: countJsonChars(payload),
    };
  },
};

module.exports = { moveRemoteSiteFileTool };
