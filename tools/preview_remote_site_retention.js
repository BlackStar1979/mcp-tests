"use strict";

const {
  PREVIEW_REMOTE_SITE_RETENTION_INPUT_SCHEMA,
  PREVIEW_REMOTE_SITE_RETENTION_OUTPUT_SCHEMA,
  REMOTE_SITE_READ_ONLY_ANNOTATIONS,
} = require("../src/schemas/remote_site_tools");
const {
  countJsonChars,
  previewRemoteSiteRetention,
  summarizeRemoteSiteArgs,
} = require("../src/util/remote_site_tools");

const TOOL_NAME = "preview_remote_site_retention";

async function execute(args = {}) {
  try {
    const result = await previewRemoteSiteRetention(args);
    return {
      success: true,
      mode: result.mode,
      purge_count: result.purge_count,
      summary: result.summary,
      text: result.text,
      error: "",
    };
  } catch (error) {
    return {
      success: false,
      mode: "error",
      purge_count: 0,
      summary: {
        generated_at: new Date().toISOString(),
        referenced_artifacts_count: 0,
        invalid_metadata_records: 0,
        invalid_inventory_entries: 0,
        purge_candidates: 0,
      },
      text: "",
      error: error?.message || String(error),
    };
  }
}

const previewRemoteSiteRetentionTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Preview remote site retention",
    description: "Read-only retention preview for remote site ops artifacts without deleting anything.",
    inputSchema: PREVIEW_REMOTE_SITE_RETENTION_INPUT_SCHEMA,
    outputSchema: PREVIEW_REMOTE_SITE_RETENTION_OUTPUT_SCHEMA,
    annotations: REMOTE_SITE_READ_ONLY_ANNOTATIONS,
  },
  execute,
  summarizeArgs: summarizeRemoteSiteArgs,
  resultStats(payload = {}) {
    return {
      result_count: Number(payload.purge_count || 0),
      result_chars: countJsonChars(payload),
    };
  },
};

module.exports = { previewRemoteSiteRetentionTool };
