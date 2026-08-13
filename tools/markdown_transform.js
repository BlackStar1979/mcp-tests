"use strict";

const {
  MARKDOWN_TRANSFORM_INPUT_SCHEMA,
  MARKDOWN_TRANSFORM_OUTPUT_SCHEMA,
} = require("../src/schemas/structured_file_tools");
const {
  commitMarkdownTransform,
  prepareMarkdownTransform,
} = require("../src/util/markdown_structure");

function normalize(payload) {
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
      code: String(error?.code || "markdown_transform_error"),
      message: String(error?.message || error),
      retryable: false,
    },
  };
}

async function execute(args = {}, context = {}) {
  try {
    if (args.action !== "preview" && args.action !== "commit") {
      throw Object.assign(new Error("markdown_transform action must be preview or commit."), { code: "markdown_transform_action_invalid" });
    }
    return normalize(args.action === "preview"
      ? await prepareMarkdownTransform(args, context)
      : await commitMarkdownTransform(args, context));
  } catch (error) {
    return errorOutput(args, error);
  }
}

const markdownTransformTool = {
  name: "markdown_transform",
  descriptor: {
    name: "markdown_transform",
    title: "Transform one Markdown section",
    description: "Replace, append to, or insert around one hash-bound Markdown section selected by heading ancestry and occurrence. It edits exact source bytes through file_transform and never serializes the whole Markdown AST. Preview first, then commit with the receipt.",
    inputSchema: MARKDOWN_TRANSFORM_INPUT_SCHEMA,
    outputSchema: MARKDOWN_TRANSFORM_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  execute,
  summarizeArgs(args = {}) {
    return {
      action: String(args.action || ""),
      path_length_chars: String(args.path || "").length,
      operation_kind: String(args.operation?.kind || ""),
      heading_depth: Array.isArray(args.operation?.section?.heading_path) ? args.operation.section.heading_path.length : 0,
      occurrence: Number(args.operation?.section?.occurrence || 1),
      inline_content_chars: String(args.operation?.content?.inline || "").length,
      staged_content: Boolean(args.operation?.content?.stage_id),
      file_content_source: Boolean(args.operation?.content?.file),
      receipt_present: Boolean(args.receipt),
    };
  },
  resultStats(payload = {}) {
    return { result_count: payload.success ? 1 : 0, result_chars: JSON.stringify(payload || {}).length };
  },
};

module.exports = { markdownTransformTool };
