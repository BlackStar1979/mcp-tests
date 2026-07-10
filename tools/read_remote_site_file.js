"use strict";

const {
  READ_REMOTE_SITE_FILE_INPUT_SCHEMA,
  READ_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
  REMOTE_SITE_READ_ONLY_ANNOTATIONS,
} = require("../src/schemas/remote_site_tools");
const {
  countJsonChars,
  readRemoteSiteFile,
  summarizeRemoteSiteArgs,
} = require("../src/util/remote_site_tools");

const TOOL_NAME = "read_remote_site_file";

async function execute(args = {}) {
  try {
    const result = await readRemoteSiteFile(args);
    return {
      success: true,
      status: "ok",
      remote_path: result.remote_path,
      bytes: result.bytes,
      text: result.text,
      error: "",
    };
  } catch (error) {
    return {
      success: false,
      status: "error",
      remote_path: String(args.remote_path || ""),
      bytes: 0,
      text: "",
      error: error?.message || String(error),
    };
  }
}

const readRemoteSiteFileTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Read remote site file",
    description: "Read a bounded UTF-8 file under the configured remote site root using SFTP.",
    inputSchema: READ_REMOTE_SITE_FILE_INPUT_SCHEMA,
    outputSchema: READ_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
    annotations: REMOTE_SITE_READ_ONLY_ANNOTATIONS,
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

module.exports = { readRemoteSiteFileTool };
