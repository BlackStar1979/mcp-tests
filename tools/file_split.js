"use strict";

const {
  FILE_COMPOSE_OUTPUT_SCHEMA,
  FILE_SPLIT_INPUT_SCHEMA,
} = require("../src/schemas/structured_file_tools");
const { commitSplit, prepareSplit } = require("../src/util/file_compose");

function normalize(payload) {
  return {
    success: true,
    status: payload.status,
    kind: "split",
    operation_id: payload.operation_id || null,
    source_count: Number(payload.source_count || 0),
    output_count: Number(payload.output_count || 0),
    outputs: (payload.outputs || []).map((item) => ({ ...item, selector: item.selector || null })),
    receipt: String(payload.receipt || ""),
    error: null,
  };
}

function errorOutput(error) {
  return {
    success: false,
    status: "error",
    kind: "split",
    operation_id: error?.operationId || null,
    source_count: 0,
    output_count: 0,
    outputs: [],
    receipt: "",
    error: {
      code: String(error?.code || "file_split_error"),
      message: String(error?.message || error),
      retryable: false,
    },
  };
}

async function execute(args = {}, context = {}) {
  try {
    if (args.action !== "preview" && args.action !== "commit") {
      throw Object.assign(new Error("file_split action must be preview or commit."), { code: "file_compose_action_invalid" });
    }
    return normalize(args.action === "preview"
      ? await prepareSplit(args, context)
      : await commitSplit(args, context));
  } catch (error) {
    return errorOutput(error);
  }
}

const fileSplitTool = {
  name: "file_split",
  descriptor: {
    name: "file_split",
    title: "Split one physical file",
    description: "Copy hash-bound ranges from one physical UTF-8 source into several physical destination files without transmitting source content. Use only for physical file decomposition; sources are never deleted. Preview first, then commit with the receipt.",
    inputSchema: FILE_SPLIT_INPUT_SCHEMA,
    outputSchema: FILE_COMPOSE_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  execute,
  summarizeArgs(args = {}) {
    return {
      action: String(args.action || ""),
      source_length_chars: String(args.source || "").length,
      part_count: Array.isArray(args.parts) ? args.parts.length : 0,
      require_full_coverage: args.require_full_coverage === true,
      receipt_present: Boolean(args.receipt),
    };
  },
  resultStats(payload = {}) {
    return { result_count: payload.success ? payload.output_count : 0, result_chars: JSON.stringify(payload || {}).length };
  },
};

module.exports = { fileSplitTool };
