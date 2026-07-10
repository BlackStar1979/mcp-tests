"use strict";

const {
  EDIT_REMOTE_SITE_FILE_INPUT_SCHEMA,
  EDIT_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
  REMOTE_SITE_MUTATION_ANNOTATIONS,
} = require("../src/schemas/remote_site_tools");
const {
  countJsonChars,
  editRemoteSiteFile,
  summarizeRemoteSiteArgs,
} = require("../src/util/remote_site_tools");

const TOOL_NAME = "edit_remote_site_file";

async function execute(args = {}) {
  try {
    const result = await editRemoteSiteFile(args);
    return { success: true, error: "", ...result };
  } catch (error) {
    return {
      success: false,
      status: "error",
      remote_path: typeof args.remote_path === "string" ? args.remote_path : "",
      bytes: 0,
      diff: "",
      metadata_path: "",
      operation_id: "",
      correlation_id: "",
      error: error?.message || String(error),
    };
  }
}

const editRemoteSiteFileTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Edit remote site file",
    description: "Replace a bounded remote-site file over SFTP and persist a diff/metadata trail outside webroot.",
    inputSchema: EDIT_REMOTE_SITE_FILE_INPUT_SCHEMA,
    outputSchema: EDIT_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
    annotations: REMOTE_SITE_MUTATION_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) {
    const summary = summarizeRemoteSiteArgs(args);
    summary.content_chars = String(args.content || "").length;
    return summary;
  },
  resultStats(payload = {}) {
    return {
      result_count: payload.success ? 1 : 0,
      result_chars: countJsonChars(payload),
    };
  },
};

module.exports = { editRemoteSiteFileTool };
