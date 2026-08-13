"use strict";

const {
  FILE_TRANSFORM_INPUT_SCHEMA,
  FILE_TRANSFORM_OUTPUT_SCHEMA,
} = require("../src/schemas/structured_file_tools");
const {
  commitFileTransform,
  prepareFileTransform,
} = require("../src/util/file_transform_engine");

const TOOL_NAME = "file_transform";

function normalizeSuccess(payload) {
  const sourceBytes = Number(payload.source_bytes ?? payload.bytes_before ?? 0);
  return {
    success: true,
    status: payload.status,
    path: String(payload.path || ""),
    source_sha256: payload.source_sha256 || null,
    result_sha256: payload.result_sha256 || null,
    source_bytes: sourceBytes,
    bytes_before: Number(payload.bytes_before ?? sourceBytes),
    bytes_after: Number(payload.bytes_after || 0),
    delta_bytes: Number(payload.delta_bytes || 0),
    operation_count: Number(payload.operation_count || 0),
    operations: Array.isArray(payload.operations) ? payload.operations : [],
    receipt: String(payload.receipt || ""),
    backup: payload.backup || null,
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    error: null,
  };
}

function errorOutput(args, error) {
  return {
    success: false,
    status: "error",
    path: String(args.path || ""),
    source_sha256: null,
    result_sha256: null,
    source_bytes: 0,
    bytes_before: 0,
    bytes_after: 0,
    delta_bytes: 0,
    operation_count: 0,
    operations: [],
    receipt: "",
    backup: null,
    warnings: [],
    error: {
      code: String(error?.code || "file_transform_error"),
      message: String(error?.message || error),
      retryable: false,
    },
  };
}

async function execute(args = {}, context = {}) {
  const action = String(args.action || "");
  try {
    if (action !== "preview" && action !== "commit") {
      throw Object.assign(new Error(`Unsupported file_transform action: ${action || "(empty)"}`), {
        code: "file_transform_action_invalid",
      });
    }
    const engine = context.fileTransformEngine || {
      prepare: prepareFileTransform,
      commit: commitFileTransform,
    };
    const payload = action === "preview"
      ? await engine.prepare(args, context)
      : await engine.commit(args, context);
    return normalizeSuccess(payload);
  } catch (error) {
    return errorOutput(args, error);
  }
}

const fileTransformTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Transform one file by exact ranges",
    description: "Insert, replace, delete, or append within one file (UTF-8) using hash-bound selectors and streaming atomic replacement. Use file_split when one physical file must become several files; use file_merge for several physical sources; use Markdown tools when headings define the target.",
    inputSchema: FILE_TRANSFORM_INPUT_SCHEMA,
    outputSchema: FILE_TRANSFORM_OUTPUT_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  execute,
  summarizeArgs(args = {}) {
    const operations = Array.isArray(args.operations) ? args.operations : [];
    return {
      action: String(args.action || ""),
      path_length_chars: String(args.path || "").length,
      operation_count: operations.length,
      operation_kinds: operations.map((item) => String(item?.kind || "")).slice(0, 100),
      inline_content_chars: operations.reduce((sum, item) => sum + String(item?.content?.inline || "").length, 0),
      stage_reference_count: operations.filter((item) => Boolean(item?.content?.stage_id)).length,
      file_reference_count: operations.filter((item) => Boolean(item?.content?.file)).length,
      receipt_present: Boolean(args.receipt),
    };
  },
  resultStats(payload = {}) {
    return { result_count: payload.success ? 1 : 0, result_chars: JSON.stringify(payload || {}).length };
  },
};

module.exports = { fileTransformTool };
