"use strict";

const {
  FILE_COMPOSE_OUTPUT_SCHEMA,
  FILE_MERGE_INPUT_SCHEMA,
} = require("../src/schemas/structured_file_tools");
const { commitMerge, prepareMerge } = require("../src/util/file_compose");

function normalize(payload) {
  return {
    success: true,
    status: payload.status,
    kind: "merge",
    operation_id: payload.operation_id || null,
    source_count: Number(payload.source_count || 0),
    output_count: Number(payload.output_count || 0),
    outputs: (payload.outputs || []).map((item) => ({ ...item, selector: null })),
    receipt: String(payload.receipt || ""),
    error: null,
  };
}

function errorOutput(error) {
  return {
    success: false,
    status: "error",
    kind: "merge",
    operation_id: error?.operationId || null,
    source_count: 0,
    output_count: 0,
    outputs: [],
    receipt: "",
    error: {
      code: String(error?.code || "file_merge_error"),
      message: String(error?.message || error),
      retryable: false,
    },
  };
}

async function execute(args = {}, context = {}) {
  try {
    if (args.action !== "preview" && args.action !== "commit") {
      throw Object.assign(new Error("file_merge action must be preview or commit."), { code: "file_compose_action_invalid" });
    }
    return normalize(args.action === "preview"
      ? await prepareMerge(args, context)
      : await commitMerge(args, context));
  } catch (error) {
    return errorOutput(error);
  }
}

const fileMergeTool = {
  name: "file_merge",
  descriptor: {
    name: "file_merge",
    title: "Merge physical files in order",
    description: "Stream several hash-bound physical UTF-8 source files into one destination in explicit order. Use only for physical concatenation; sources are never deleted. Preview first, then commit with the receipt.",
    inputSchema: FILE_MERGE_INPUT_SCHEMA,
    outputSchema: FILE_COMPOSE_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  execute,
  summarizeArgs(args = {}) {
    return {
      action: String(args.action || ""),
      source_count: Array.isArray(args.sources) ? args.sources.length : 0,
      destination_length_chars: String(args.destination || "").length,
      separator_chars: String(args.separator || "").length,
      allow_repeated_sources: args.allow_repeated_sources === true,
      receipt_present: Boolean(args.receipt),
    };
  },
  resultStats(payload = {}) {
    return { result_count: payload.success ? payload.output_count : 0, result_chars: JSON.stringify(payload || {}).length };
  },
};

module.exports = { fileMergeTool };
