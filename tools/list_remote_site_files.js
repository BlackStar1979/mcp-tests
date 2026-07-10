"use strict";

const {
  LIST_REMOTE_SITE_FILES_INPUT_SCHEMA,
  LIST_REMOTE_SITE_FILES_OUTPUT_SCHEMA,
  REMOTE_SITE_READ_ONLY_ANNOTATIONS,
} = require("../src/schemas/remote_site_tools");
const {
  countJsonChars,
  listRemoteSiteFiles,
  summarizeRemoteSiteArgs,
} = require("../src/util/remote_site_tools");

const TOOL_NAME = "list_remote_site_files";

async function execute(args = {}) {
  try {
    const result = await listRemoteSiteFiles(args);
    return {
      success: true,
      status: "ok",
      remote_path: result.remote_path,
      count: result.count,
      entries: result.entries,
      error: "",
    };
  } catch (error) {
    return {
      success: false,
      status: "error",
      remote_path: String(args.remote_path || "."),
      count: 0,
      entries: [],
      error: error?.message || String(error),
    };
  }
}

const listRemoteSiteFilesTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "List remote site files",
    description: "Read-only bounded SFTP listing under the configured remote site root using a per-call VPS config reference.",
    inputSchema: LIST_REMOTE_SITE_FILES_INPUT_SCHEMA,
    outputSchema: LIST_REMOTE_SITE_FILES_OUTPUT_SCHEMA,
    annotations: REMOTE_SITE_READ_ONLY_ANNOTATIONS,
  },
  execute,
  summarizeArgs: summarizeRemoteSiteArgs,
  resultStats(payload = {}) {
    return {
      result_count: Number(payload.count || 0),
      result_chars: countJsonChars(payload),
    };
  },
};

module.exports = { listRemoteSiteFilesTool };
