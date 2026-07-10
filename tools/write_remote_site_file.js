"use strict";

const {
  REMOTE_SITE_MUTATION_ANNOTATIONS,
  WRITE_REMOTE_SITE_FILE_INPUT_SCHEMA,
  WRITE_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
} = require("../src/schemas/remote_site_tools");
const {
  countJsonChars,
  summarizeRemoteSiteArgs,
  writeRemoteSiteFile,
} = require("../src/util/remote_site_tools");

const TOOL_NAME = "write_remote_site_file";

async function execute(args = {}) {
  try {
    const result = await writeRemoteSiteFile(args);
    return { success: true, error: "", ...result };
  } catch (error) {
    return {
      success: false,
      status: "error",
      remote_path: typeof args.remote_path === "string" ? args.remote_path : "",
      bytes: 0,
      diff_created: false,
      metadata_path: "",
      operation_id: "",
      correlation_id: "",
      error: error?.message || String(error),
    };
  }
}

const writeRemoteSiteFileTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Write remote site file",
    description: "Create or overwrite a bounded remote-site file over SFTP with diff/metadata artifacts outside webroot.",
    inputSchema: WRITE_REMOTE_SITE_FILE_INPUT_SCHEMA,
    outputSchema: WRITE_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
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

module.exports = { writeRemoteSiteFileTool };
