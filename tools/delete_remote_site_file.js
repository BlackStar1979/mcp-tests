"use strict";

const {
  DELETE_REMOTE_SITE_FILE_INPUT_SCHEMA,
  DELETE_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
  REMOTE_SITE_MUTATION_ANNOTATIONS,
} = require("../src/schemas/remote_site_tools");
const {
  countJsonChars,
  deleteRemoteSiteFile,
  summarizeRemoteSiteArgs,
} = require("../src/util/remote_site_tools");

const TOOL_NAME = "delete_remote_site_file";

async function execute(args = {}) {
  try {
    const result = await deleteRemoteSiteFile(args);
    return { success: true, error: "", ...result };
  } catch (error) {
    return {
      success: false,
      status: "error",
      remote_path: typeof args.remote_path === "string" ? args.remote_path : "",
      trash_path: "",
      metadata_path: "",
      operation_id: "",
      correlation_id: "",
      error: error?.message || String(error),
    };
  }
}

const deleteRemoteSiteFileTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Delete remote site file",
    description: "Soft-delete a bounded remote-site file by moving it into the private trash area outside webroot.",
    inputSchema: DELETE_REMOTE_SITE_FILE_INPUT_SCHEMA,
    outputSchema: DELETE_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
    annotations: REMOTE_SITE_MUTATION_ANNOTATIONS,
  },
  execute,
  summarizeArgs: summarizeRemoteSiteArgs,
  resultStats(payload = {}) {
    return {
      result_count: payload.success ? 1 : 0,
      result_chars: countJsonChars(payload),
    };
  },
};

module.exports = { deleteRemoteSiteFileTool };
