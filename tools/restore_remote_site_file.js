"use strict";

const {
  REMOTE_SITE_MUTATION_ANNOTATIONS,
  RESTORE_REMOTE_SITE_FILE_INPUT_SCHEMA,
  RESTORE_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
} = require("../src/schemas/remote_site_tools");
const {
  countJsonChars,
  restoreRemoteSiteFile,
} = require("../src/util/remote_site_tools");

const TOOL_NAME = "restore_remote_site_file";

async function execute(args = {}) {
  try {
    const result = await restoreRemoteSiteFile(args);
    return { success: true, error: "", ...result };
  } catch (error) {
    return {
      success: false,
      status: "error",
      remote_path: "",
      restored_from: "",
      restored_to: "",
      source_operation_id: typeof args.operation_id === "string" ? args.operation_id : "",
      restore_operation_id: "",
      correlation_id: "",
      restore_metadata_path: "",
      error: error?.message || String(error),
    };
  }
}

const restoreRemoteSiteFileTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Restore remote site file",
    description: "Restore a previously soft-deleted remote-site file from private trash using its delete operation metadata id.",
    inputSchema: RESTORE_REMOTE_SITE_FILE_INPUT_SCHEMA,
    outputSchema: RESTORE_REMOTE_SITE_FILE_OUTPUT_SCHEMA,
    annotations: REMOTE_SITE_MUTATION_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) {
    return {
      has_config_ref: Boolean(args.vps_config_ref),
      operation_id: typeof args.operation_id === "string" ? args.operation_id : "",
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: payload.success ? 1 : 0,
      result_chars: countJsonChars(payload),
    };
  },
};

module.exports = { restoreRemoteSiteFileTool };
