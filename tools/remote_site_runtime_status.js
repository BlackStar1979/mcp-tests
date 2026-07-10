"use strict";

const {
  REMOTE_SITE_READ_ONLY_ANNOTATIONS,
  REMOTE_SITE_RUNTIME_STATUS_INPUT_SCHEMA,
  REMOTE_SITE_RUNTIME_STATUS_OUTPUT_SCHEMA,
} = require("../src/schemas/remote_site_tools");
const {
  countJsonChars,
  remoteSiteRuntimeStatus,
  summarizeRemoteSiteArgs,
} = require("../src/util/remote_site_tools");

const TOOL_NAME = "remote_site_runtime_status";

async function execute(args = {}) {
  try {
    const result = await remoteSiteRuntimeStatus(args);
    return {
      success: true,
      status: result.status,
      generated_at: result.generated_at,
      inventory: result.inventory,
      metadata: result.metadata,
      logs: result.logs,
      warnings: result.warnings,
      text: result.text,
      error: "",
    };
  } catch (error) {
    return {
      success: false,
      status: "error",
      generated_at: new Date().toISOString(),
      inventory: {},
      metadata: {},
      logs: {},
      warnings: [],
      text: "",
      error: error?.message || String(error),
    };
  }
}

const remoteSiteRuntimeStatusTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Remote site runtime status",
    description: "Read-only bounded introspection of remote site opsRoot inventory, metadata, log health, and retention warnings.",
    inputSchema: REMOTE_SITE_RUNTIME_STATUS_INPUT_SCHEMA,
    outputSchema: REMOTE_SITE_RUNTIME_STATUS_OUTPUT_SCHEMA,
    annotations: REMOTE_SITE_READ_ONLY_ANNOTATIONS,
  },
  execute,
  summarizeArgs: summarizeRemoteSiteArgs,
  resultStats(payload = {}) {
    return {
      result_count: Array.isArray(payload.warnings) ? payload.warnings.length : 0,
      result_chars: countJsonChars(payload),
    };
  },
};

module.exports = { remoteSiteRuntimeStatusTool };
