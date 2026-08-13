"use strict";

const {
  FILE_INSPECT_INPUT_SCHEMA,
  FILE_INSPECT_OUTPUT_SCHEMA,
} = require("../src/schemas/structured_file_tools");
const {
  inspectTextFile,
  readSelectorContext,
  resolveSelector,
} = require("../src/util/file_selectors");
const { safeWorkspacePath } = require("../src/util/workspace_roots");

const TOOL_NAME = "file_inspect";

async function inspect(args = {}, context = {}) {
  const resolved = safeWorkspacePath(args.path);
  const info = await inspectTextFile(resolved.absolutePath, { maxFileBytes: context.maxFileBytes });
  let selector = null;
  let boundedContext = null;
  if (args.selector) {
    const range = await resolveSelector(resolved.absolutePath, args.selector, {
      fileInfo: info,
      maxFileBytes: context.maxFileBytes,
      markdownResolver: context.markdownResolver || require("../src/util/markdown_structure").resolveMarkdownSection,
    });
    selector = {
      kind: String(args.selector.kind || ""),
      start_byte: range.startByte,
      end_byte: range.endByte,
      bytes: range.bytes,
      range_sha256: range.rangeSha256,
      matches: range.matches,
      line_start: range.lineStart,
      line_end: range.lineEnd,
    };
    boundedContext = await readSelectorContext(resolved.absolutePath, range, {
      beforeChars: args.context_before_chars,
      afterChars: args.context_after_chars,
    });
  }
  return {
    path: resolved.displayPath,
    bytes: info.bytes,
    file_sha256: info.fileSha256,
    has_utf8_bom: info.hasUtf8Bom,
    dominant_eol: info.dominantEol,
    total_lines: info.totalLines,
    selector,
    context: boundedContext,
  };
}

async function execute(args = {}, context = {}) {
  try {
    const api = context.structuredFileApi || { inspect };
    return { success: true, ...(await api.inspect(args, context)), error: null };
  } catch (error) {
    return {
      success: false,
      path: String(args.path || ""),
      bytes: 0,
      file_sha256: null,
      has_utf8_bom: false,
      dominant_eol: "\n",
      total_lines: 0,
      selector: null,
      context: null,
      error: {
        code: String(error?.code || "file_inspect_error"),
        message: String(error?.message || error),
        retryable: false,
      },
    };
  }
}

const fileInspectTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Inspect exact file ranges",
    description: "Inspect hashes, exact selectors, and bounded nearby context without reading the complete text into model context. Use before file_transform, file_split, or a Markdown structural edit.",
    inputSchema: FILE_INSPECT_INPUT_SCHEMA,
    outputSchema: FILE_INSPECT_OUTPUT_SCHEMA,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  execute,
  summarizeArgs(args = {}) {
    return {
      path_length_chars: String(args.path || "").length,
      selector_kind: String(args.selector?.kind || "none"),
      context_before_chars: Number(args.context_before_chars || 0),
      context_after_chars: Number(args.context_after_chars || 0),
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: payload.success ? 1 : 0,
      result_chars: String(payload.context?.before || "").length
        + String(payload.context?.selected || "").length
        + String(payload.context?.after || "").length,
    };
  },
};

module.exports = { fileInspectTool };
