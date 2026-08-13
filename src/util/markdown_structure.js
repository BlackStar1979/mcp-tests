"use strict";

const { createHash } = require("node:crypto");
const fsp = require("node:fs/promises");

const { commitFileTransform, prepareFileTransform } = require("./file_transform_engine");
const { inspectTextFile } = require("./file_selectors");
const { safeWorkspacePath } = require("./workspace_roots");

const DEFAULT_MAX_MARKDOWN_BYTES = 16 * 1024 * 1024;
let parserPromise = null;

function markdownError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function configuredMaxMarkdownBytes(options = {}) {
  const value = Number(options.maxMarkdownBytes || process.env.MCP_MARKDOWN_MAX_BYTES || DEFAULT_MAX_MARKDOWN_BYTES);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw markdownError("Markdown document size limit must be a positive integer.", "markdown_config_invalid");
  }
  return value;
}

async function loadParser() {
  if (!parserPromise) {
    parserPromise = Promise.all([
      import("unified"),
      import("remark-parse"),
      import("remark-gfm"),
      import("remark-frontmatter"),
    ]).then(([unifiedModule, parseModule, gfmModule, frontmatterModule]) => (
      unifiedModule.unified()
        .use(parseModule.default)
        .use(gfmModule.default)
        .use(frontmatterModule.default, ["yaml", "toml"])
    ));
  }
  return parserPromise;
}

function nodeText(node) {
  if (!node || typeof node !== "object") return "";
  if (typeof node.value === "string" && (node.type === "text" || node.type === "inlineCode")) return node.value;
  if (node.type === "image" && typeof node.alt === "string") return node.alt;
  return Array.isArray(node.children) ? node.children.map(nodeText).join("") : "";
}

function visit(node, callback) {
  if (!node || typeof node !== "object") return;
  callback(node);
  if (Array.isArray(node.children)) for (const child of node.children) visit(child, callback);
}

function byteOffsetMap(text, offsets) {
  const sorted = [...new Set(offsets)].sort((left, right) => left - right);
  const result = new Map();
  let previousOffset = 0;
  let previousBytes = 0;
  for (const offset of sorted) {
    previousBytes += Buffer.byteLength(text.slice(previousOffset, offset), "utf8");
    result.set(offset, previousBytes);
    previousOffset = offset;
  }
  return result;
}

function consumeLineEnding(text, offset) {
  if (text.startsWith("\r\n", offset)) return offset + 2;
  if (text[offset] === "\n" || text[offset] === "\r") return offset + 1;
  return offset;
}

function documentFeatures(tree) {
  const features = {
    frontmatter: false,
    gfm_table: false,
    task_list: false,
    code_block: false,
    html: false,
  };
  visit(tree, (node) => {
    if (node.type === "yaml" || node.type === "toml") features.frontmatter = true;
    if (node.type === "table") features.gfm_table = true;
    if (node.type === "listItem" && typeof node.checked === "boolean") features.task_list = true;
    if (node.type === "code") features.code_block = true;
    if (node.type === "html") features.html = true;
  });
  return features;
}

async function parseMarkdownAbsolute(absolutePath, options = {}) {
  const maxMarkdownBytes = configuredMaxMarkdownBytes(options);
  let info = options.fileInfo;
  if (!info) {
    try {
      info = await inspectTextFile(absolutePath, { maxFileBytes: maxMarkdownBytes });
    } catch (error) {
      if (error?.code === "structured_file_size_limit") {
        throw markdownError(`Markdown document exceeds ${maxMarkdownBytes} bytes.`, "markdown_document_too_large");
      }
      throw error;
    }
  }
  if (info.bytes > maxMarkdownBytes) {
    throw markdownError(`Markdown document exceeds ${maxMarkdownBytes} bytes.`, "markdown_document_too_large");
  }
  const buffer = await fsp.readFile(absolutePath);
  const currentHash = createHash("sha256").update(buffer).digest("hex");
  if (currentHash !== info.fileSha256) {
    throw markdownError("Markdown document changed while it was being parsed.", "file_transform_source_changed");
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw markdownError("Markdown document is not valid UTF-8.", "structured_file_invalid_utf8");
  }
  const parser = await loadParser();
  const tree = parser.parse(text);
  const rawHeadings = tree.children.filter((node) => node.type === "heading" && node.position?.start && node.position?.end);
  const offsets = [0, text.length];
  const interim = [];
  const stack = [];
  const occurrences = new Map();
  for (let index = 0; index < rawHeadings.length; index += 1) {
    const node = rawHeadings[index];
    while (stack.length && stack[stack.length - 1].depth >= node.depth) stack.pop();
    const title = nodeText(node);
    const headingPath = [...stack.map((item) => item.title), title];
    const occurrenceKey = JSON.stringify(headingPath);
    const occurrence = (occurrences.get(occurrenceKey) || 0) + 1;
    occurrences.set(occurrenceKey, occurrence);
    let nextBoundary = text.length;
    let nextBoundaryLine = info.totalLines + 1;
    let childCount = 0;
    for (let cursor = index + 1; cursor < rawHeadings.length; cursor += 1) {
      if (rawHeadings[cursor].depth <= node.depth) {
        nextBoundary = rawHeadings[cursor].position.start.offset;
        nextBoundaryLine = rawHeadings[cursor].position.start.line;
        break;
      }
      childCount += 1;
    }
    const startOffset = node.position.start.offset;
    const headingEndOffset = node.position.end.offset;
    const bodyStartOffset = consumeLineEnding(text, headingEndOffset);
    offsets.push(startOffset, headingEndOffset, bodyStartOffset, nextBoundary);
    interim.push({
      title,
      headingPath,
      depth: node.depth,
      occurrence,
      childCount,
      startOffset,
      headingEndOffset,
      bodyStartOffset,
      endOffset: nextBoundary,
      lineStart: node.position.start.line,
      lineEnd: Math.min(info.totalLines, nextBoundaryLine - 1),
    });
    stack.push({ depth: node.depth, title });
  }
  const byteOffsets = byteOffsetMap(text, offsets);
  const headings = interim.map((item) => {
    const startByte = byteOffsets.get(item.startOffset);
    const endByte = byteOffsets.get(item.endOffset);
    return {
      title: item.title,
      heading_path: item.headingPath,
      depth: item.depth,
      occurrence: item.occurrence,
      start_byte: startByte,
      heading_end_byte: byteOffsets.get(item.headingEndOffset),
      body_start_byte: byteOffsets.get(item.bodyStartOffset),
      end_byte: endByte,
      line_start: item.lineStart,
      line_end: item.lineEnd,
      section_sha256: createHash("sha256").update(buffer.subarray(startByte, endByte)).digest("hex"),
      child_count: item.childCount,
    };
  });
  return {
    bytes: info.bytes,
    fileSha256: info.fileSha256,
    hasFinalNewline: text.endsWith("\n") || text.endsWith("\r"),
    dominantEol: info.dominantEol,
    totalLines: info.totalLines,
    features: options.includeDocumentFeatures === false ? null : documentFeatures(tree),
    headings,
  };
}

function findSection(parsed, selector = {}) {
  const requestedPath = Array.isArray(selector.heading_path) ? selector.heading_path.map(String) : [];
  const matches = parsed.headings.filter((item) => (
    item.heading_path.length === requestedPath.length
    && item.heading_path.every((part, index) => part === requestedPath[index])
  ));
  const occurrence = Number(selector.occurrence || 1);
  const selected = matches[occurrence - 1];
  if (!selected) {
    throw markdownError("Markdown section was not found at the requested heading path and occurrence.", "markdown_section_not_found");
  }
  const expectedHash = String(selector.expected_section_sha256 || selector.expected_sha256 || "").toLowerCase();
  if (expectedHash && expectedHash !== selected.section_sha256) {
    throw markdownError("Markdown section changed after inspection.", "markdown_section_hash_mismatch");
  }
  return { selected, matches: matches.length };
}

async function inspectMarkdown(relativePath, options = {}) {
  const resolved = safeWorkspacePath(relativePath);
  const parsed = await parseMarkdownAbsolute(resolved.absolutePath, options);
  const requestedMax = Number(options.maxNodes ?? options.max_nodes ?? 100);
  const maxNodes = Number.isSafeInteger(requestedMax) ? Math.max(1, Math.min(500, requestedMax)) : 100;
  return {
    path: resolved.displayPath,
    bytes: parsed.bytes,
    file_sha256: parsed.fileSha256,
    has_final_newline: parsed.hasFinalNewline,
    dominant_eol: parsed.dominantEol,
    total_lines: parsed.totalLines,
    heading_count: parsed.headings.length,
    headings: parsed.headings.slice(0, maxNodes),
    features: parsed.features,
    truncated: parsed.headings.length > maxNodes,
  };
}

async function resolveMarkdownSection(absolutePath, selector = {}, options = {}) {
  const parsed = await parseMarkdownAbsolute(absolutePath, {
    ...options,
    fileInfo: options.fileInfo,
    includeDocumentFeatures: false,
  });
  const { selected, matches } = findSection(parsed, selector);
  return {
    startByte: selected.start_byte,
    endByte: selected.end_byte,
    lineStart: selected.line_start,
    lineEnd: selected.line_end,
    rangeSha256: selected.section_sha256,
    matches,
  };
}

async function compileMarkdownTransform(input = {}, context = {}) {
  const resolved = safeWorkspacePath(input.path);
  const parsed = await parseMarkdownAbsolute(resolved.absolutePath, { ...context, includeDocumentFeatures: false });
  if (String(input.expected_file_sha256 || "").toLowerCase() !== parsed.fileSha256) {
    throw markdownError("Markdown file changed or expected_file_sha256 is invalid.", "file_transform_source_changed");
  }
  const operation = input.operation || {};
  const { selected } = findSection(parsed, operation.section || {});
  let kind;
  let startByte;
  let endByte;
  if (operation.kind === "replace_section_body") {
    kind = "replace";
    startByte = selected.body_start_byte;
    endByte = selected.end_byte;
  } else if (operation.kind === "append_to_section") {
    kind = "insert_before";
    startByte = selected.end_byte;
    endByte = selected.end_byte;
  } else if (operation.kind === "insert_section_before") {
    kind = "insert_before";
    startByte = selected.start_byte;
    endByte = selected.start_byte;
  } else if (operation.kind === "insert_section_after") {
    kind = "insert_after";
    startByte = selected.end_byte;
    endByte = selected.end_byte;
  } else if (operation.kind === "replace_section") {
    kind = "replace";
    startByte = selected.start_byte;
    endByte = selected.end_byte;
  } else {
    throw markdownError("Unsupported Markdown transform operation.", "markdown_transform_operation_invalid");
  }
  return {
    action: input.action,
    path: input.path,
    expected_file_sha256: parsed.fileSha256,
    operations: [{
      kind,
      selector: { kind: "bytes", start_byte: startByte, end_byte: endByte },
      content: operation.content,
    }],
    receipt: input.receipt,
    allow_protected: input.allow_protected === true,
  };
}

async function prepareMarkdownTransform(input = {}, context = {}) {
  return prepareFileTransform(await compileMarkdownTransform(input, context), context);
}

async function commitMarkdownTransform(input = {}, context = {}) {
  return commitFileTransform(await compileMarkdownTransform(input, context), context);
}

module.exports = {
  DEFAULT_MAX_MARKDOWN_BYTES,
  commitMarkdownTransform,
  compileMarkdownTransform,
  inspectMarkdown,
  prepareMarkdownTransform,
  resolveMarkdownSection,
};
