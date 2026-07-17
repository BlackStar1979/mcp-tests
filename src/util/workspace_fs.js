const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const { safeWorkspacePath } = require("./workspace_roots");

const MAX_READ_FILE_CHARS = 30000;
const MAX_READ_LINES_CHARS = 50000;
const MAX_READ_CHUNK_CHARS = 50000;
const STREAM_READ_BUFFER_BYTES = 64 * 1024;

function lineCount(text) {
  if (text.length === 0) {
    return 0;
  }
  return text.split(/\r\n|\n|\r/).length;
}

function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    return fallback;
  }
  return n;
}

function makeNumberedLines(lines, firstLine) {
  return lines.map((text, index) => ({
    line: firstLine + index,
    text,
  }));
}

async function fileInfoFor(relativePath) {
  const resolved = safeWorkspacePath(relativePath);
  const stat = await fsp.stat(resolved.absolutePath);
  return {
    path: resolved.displayPath,
    type: stat.isDirectory() ? "directory" : "file",
    size: stat.size,
    created: stat.birthtime.toISOString(),
    modified: stat.mtime.toISOString(),
    root_alias: resolved.rootAlias,
  };
}

async function listDirectory(relativePath = ".") {
  const resolved = safeWorkspacePath(relativePath);
  const stat = await fsp.stat(resolved.absolutePath);
  if (!stat.isDirectory()) {
    throw new Error("Not a directory.");
  }

  const entries = await fsp.readdir(resolved.absolutePath, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    results.push(await fileInfoFor(path.posix.join(resolved.displayPath === "." ? "" : resolved.displayPath.replace(/\\/g, "/"), entry.name)));
  }

  return {
    path: resolved.displayPath,
    root_alias: resolved.rootAlias,
    count: results.length,
    entries: results,
  };
}

function appendBoundedText(current, addition, maxChars) {
  if (!addition) return { text: current, truncated: false };
  if (current.length >= maxChars) return { text: current, truncated: true };

  const remaining = maxChars - current.length;
  if (addition.length > remaining) {
    return { text: current + addition.slice(0, remaining), truncated: true };
  }

  return { text: current + addition, truncated: false };
}

function countLineBreaks(chunk, state) {
  for (const char of chunk) {
    if (char === "\n") {
      if (state.previousWasCarriageReturn) {
        state.previousWasCarriageReturn = false;
        continue;
      }
      state.lineBreaks += 1;
      continue;
    }

    if (char === "\r") {
      state.lineBreaks += 1;
      state.previousWasCarriageReturn = true;
      continue;
    }

    state.previousWasCarriageReturn = false;
  }
}

async function scanTextFile(absolutePath, maxChars) {
  const limit = normalizePositiveInt(maxChars, MAX_READ_FILE_CHARS);
  const stream = fs.createReadStream(absolutePath, {
    encoding: "utf8",
    highWaterMark: STREAM_READ_BUFFER_BYTES,
  });
  const lineState = {
    lineBreaks: 0,
    previousWasCarriageReturn: false,
  };
  let text = "";
  let truncated = false;
  let chars = 0;
  let hasContent = false;

  for await (const chunk of stream) {
    if (!chunk) {
      continue;
    }
    hasContent = true;
    chars += chunk.length;
    const appended = appendBoundedText(text, chunk, limit);
    text = appended.text;
    truncated ||= appended.truncated;
    countLineBreaks(chunk, lineState);
  }

  return {
    text,
    truncated,
    chars,
    totalLines: hasContent ? lineState.lineBreaks + 1 : 0,
  };
}

async function readFile(relativePath, { maxChars = MAX_READ_FILE_CHARS } = {}) {
  const resolved = safeWorkspacePath(relativePath);
  const stat = await fsp.stat(resolved.absolutePath);
  if (!stat.isFile()) {
    throw new Error("Not a file.");
  }

  const scanned = await scanTextFile(resolved.absolutePath, maxChars);

  return {
    path: resolved.displayPath,
    root_alias: resolved.rootAlias,
    bytes: stat.size,
    chars: scanned.chars,
    returned_chars: scanned.text.length,
    total_lines: scanned.totalLines,
    truncated: scanned.truncated,
    text: scanned.text,
    hint: scanned.truncated ? "Use read_file_lines or read_file_chunk for precise continuation." : undefined,
  };
}

async function readFileLines(relativePath, { startLine, endLine, includeLineNumbers = true, maxChars = MAX_READ_LINES_CHARS } = {}) {
  if (endLine < startLine) {
    throw new Error("end_line must be greater than or equal to start_line.");
  }

  const resolved = safeWorkspacePath(relativePath);
  const stat = await fsp.stat(resolved.absolutePath);
  if (!stat.isFile()) {
    throw new Error("Not a file.");
  }

  const text = await fsp.readFile(resolved.absolutePath, "utf8");
  const allLines = text.length === 0 ? [] : text.split(/\r\n|\n|\r/);
  const totalLines = allLines.length;
  const fromIndex = Math.max(0, startLine - 1);
  const toIndexExclusive = Math.min(totalLines, endLine);
  const selected = allLines.slice(fromIndex, toIndexExclusive);
  const effectiveStartLine = selected.length > 0 ? startLine : Math.min(startLine, totalLines + 1);

  const rendered = includeLineNumbers
    ? selected.map((line, index) => `L${effectiveStartLine + index} ${line}`).join("\n")
    : selected.join("\n");

  const limit = normalizePositiveInt(maxChars, MAX_READ_LINES_CHARS);
  const truncated = rendered.length > limit;
  const returnedText = truncated ? rendered.slice(0, limit) : rendered;

  return {
    path: resolved.displayPath,
    root_alias: resolved.rootAlias,
    bytes: stat.size,
    start_line: startLine,
    end_line: endLine,
    effective_start_line: effectiveStartLine,
    effective_end_line: selected.length > 0 ? effectiveStartLine + selected.length - 1 : null,
    total_lines: totalLines,
    returned_lines: selected.length,
    include_line_numbers: includeLineNumbers,
    returned_chars: returnedText.length,
    truncated,
    text: returnedText,
    lines: makeNumberedLines(selected, effectiveStartLine),
  };
}

async function readFileChunk(relativePath, { offset = 0, length = MAX_READ_CHUNK_CHARS } = {}) {
  const resolved = safeWorkspacePath(relativePath);
  const stat = await fsp.stat(resolved.absolutePath);
  if (!stat.isFile()) {
    throw new Error("Not a file.");
  }

  const text = await fsp.readFile(resolved.absolutePath, "utf8");
  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeLength = Math.min(normalizePositiveInt(length, MAX_READ_CHUNK_CHARS), MAX_READ_CHUNK_CHARS);
  const returnedText = text.slice(safeOffset, safeOffset + safeLength);

  return {
    path: resolved.displayPath,
    root_alias: resolved.rootAlias,
    bytes: stat.size,
    chars: text.length,
    offset: safeOffset,
    length: safeLength,
    returned_chars: returnedText.length,
    next_offset: safeOffset + returnedText.length,
    has_more: safeOffset + returnedText.length < text.length,
    text: returnedText,
  };
}

function summarizeWorkspacePath(args = {}) {
  const input = String(args.path || ".");
  const aliasMatch = input.match(/^@([a-z0-9_-]+)(?:\/|$)/i);
  return {
    arg_name: "path",
    path_length_chars: input.length,
    explicit_root_alias: aliasMatch ? aliasMatch[1].toLowerCase() : "",
  };
}

module.exports = {
  fileInfoFor,
  listDirectory,
  readFile,
  readFileChunk,
  readFileLines,
  summarizeWorkspacePath,
};
