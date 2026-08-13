"use strict";

const {
  MARKDOWN_INSPECT_INPUT_SCHEMA,
  MARKDOWN_INSPECT_OUTPUT_SCHEMA,
} = require("../src/schemas/structured_file_tools");
const { inspectMarkdown } = require("../src/util/markdown_structure");

async function execute(args = {}, context = {}) {
  try {
    return {
      success: true,
      ...(await inspectMarkdown(args.path, {
        ...context,
        maxNodes: args.max_nodes,
        includeDocumentFeatures: args.include_document_features !== false,
      })),
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      path: String(args.path || ""),
      bytes: 0,
      file_sha256: null,
      has_final_newline: false,
      dominant_eol: "\n",
      total_lines: 0,
      heading_count: 0,
      headings: [],
      features: null,
      truncated: false,
      error: {
        code: String(error?.code || "markdown_inspect_error"),
        message: String(error?.message || error),
        retryable: false,
      },
    };
  }
}

const markdownInspectTool = {
  name: "markdown_inspect",
  descriptor: {
    name: "markdown_inspect",
    title: "Inspect Markdown structure",
    description: "Return a bounded heading outline, duplicate occurrences, exact byte ranges, section hashes, and document features. Use this before markdown_transform when headings define the edit target; it never rewrites the document.",
    inputSchema: MARKDOWN_INSPECT_INPUT_SCHEMA,
    outputSchema: MARKDOWN_INSPECT_OUTPUT_SCHEMA,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  execute,
  summarizeArgs(args = {}) {
    return {
      path_length_chars: String(args.path || "").length,
      max_nodes: Number(args.max_nodes || 100),
      include_document_features: args.include_document_features !== false,
    };
  },
  resultStats(payload = {}) {
    return { result_count: payload.success ? payload.headings.length : 0, result_chars: JSON.stringify(payload || {}).length };
  },
};

module.exports = { markdownInspectTool };
