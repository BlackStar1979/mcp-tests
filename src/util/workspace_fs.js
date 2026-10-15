const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const { resolveReadableWorkspacePath } = require("./workspace_roots");

const MAX_READ_FILE_CHARS = 30000;
const MAX_READ_LINES_CHARS = 50000;
const MAX_READ_CHUNK_CHARS = 50000;
const STREAM_READ_BUFFER_BYTES = 64 * 1024;
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;
const LIST_CURSOR_VERSION = 1;

function lineCount(text) {
  if (text.length === 0) return 0;
  return text.split(/\r\n|\n|\r/).length;
}

function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return n;
}

function normalizeListLimit(value) {
  const normalized = normalizePositiveInt(value, DEFAULT_LIST_LIMIT);
  return Math.min(normalized, MAX_LIST_LIMIT);
}

function makeNumberedLines(lines, firstLine) {
  return lines.map((text, index) => ({ line: firstLine + index, text }));
}

function splitTrailingCarriageReturn(line) {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

function encodeListCursor(name) {
  return Buffer.from(JSON.stringify({ v: LIST_CURSOR_VERSION, name }), "utf8").toString("base64url");
}

function decodeListCursor(cursor) {
  if (cursor === undefined || cursor === null || cursor === "") return null;
  const raw = String(cursor);
  if (raw.length > 2048) throw new Error("Invalid directory cursor.");
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid directory cursor.");
  }
  if (parsed?.v !== LIST_CURSOR_VERSION || typeof parsed.name !== "string" || !parsed.name) {
    throw new Error("Invalid directory cursor.");
  }
  return parsed.name;
}

function compareEntryNames(left, right) {
  if (left.name === right.name) return 0;
  return left.name < right.name ? -1 : 1;
}

async function fileInfoFor(relativePath) {
  const resolved = resolveReadableWorkspacePath(relativePath);
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

async function listDirectory(relativePath = ".", { limit = DEFAULT_LIST_LIMIT, cursor = null } = {}) {
  const resolved = resolveReadableWorkspacePath(relativePath);
  const stat = await fsp.stat(resolved.absolutePath);
  if (!stat.isDirectory()) throw new Error("Not a directory.");

  const safeLimit = normalizeListLimit(limit);
  const cursorName = decodeListCursor(cursor);
  const entries = (await fsp.readdir(resolved.absolutePath, { withFileTypes: true })).sort(compareEntryNames);
  let index = cursorName === null
    ? 0
    : entries.findIndex((entry) => entry.name > cursorName);
  if (index < 0) index = entries.length;

  const results = [];
  const warnings = [];
  const displayBase = resolved.displayPath === "." ? "" : resolved.displayPath.replace(/\\/g, "/");
  let lastProcessedName = cursorName;

  while (index < entries.length && results.length < safeLimit) {
    const entry = entries[index];
    index += 1;
    lastProcessedName = entry.name;
    const childPath = path.posix.join(displayBase, entry.name);
    try {
      results.push(await fileInfoFor(childPath));
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
        warnings.push(`Entry disappeared during listing: ${entry.name}`);
        continue;
      }
      throw error;
    }
  }

  const hasMore = index < entries.length;
  return {
    path: resolved.displayPath,
    root_alias: resolved.rootAlias,
    count: entries.length,
    returned_count: results.length,
    has_more: hasMore,
    next_cursor: hasMore && lastProcessedName ? encodeListCursor(lastProcessedName) : null,
    entries: results,
    warnings,
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

function defaultStreamFactory(absolutePath, options) {
  return fs.createReadStream(absolutePath, options);
}

async function scanTextFile(
  absolutePath,
  maxChars,
  { createReadStream = defaultStreamFactory } = {}
) {
  const limit = normalizePositiveInt(maxChars, MAX_READ_FILE_CHARS);
  const stream = createReadStream(absolutePath, {
    encoding: "utf8",
    highWaterMark: STREAM_READ_BUFFER_BYTES,
  });
  let sampled = "";
  let stoppedEarly = false;
  let scannedChars = 0;

  for await (const chunk of stream) {
    if (!chunk) continue;
    const remaining = limit + 1 - sampled.length;
    const consumed = chunk.slice(0, Math.max(0, remaining));
    sampled += consumed;
    scannedChars += consumed.length;
    if (sampled.length > limit) {
      stoppedEarly = true;
      break;
    }
  }

  const complete = !stoppedEarly;
  const text = sampled.slice(0, limit);
  return {
    text,
    complete,
    hasMore: !complete,
    scannedChars,
    chars: complete ? sampled.length : null,
    totalLines: complete ? lineCount(sampled) : null,
    truncated: !complete,
  };
}

async function scanTextLines(
  absolutePath,
  { startLine, endLine, includeLineNumbers, maxChars },
  { createReadStream = defaultStreamFactory } = {}
) {
  const limit = normalizePositiveInt(maxChars, MAX_READ_LINES_CHARS);
  const stream = createReadStream(absolutePath, {
    encoding: "utf8",
    highWaterMark: STREAM_READ_BUFFER_BYTES,
  });
  let renderedText = "";
  let currentLine = 0;
  let buffer = "";
  let stoppedEarly = false;
  let outputTruncated = false;
  const selected = [];

  function processLine(rawLine) {
    currentLine += 1;
    if (currentLine > endLine) {
      stoppedEarly = true;
      return false;
    }
    if (currentLine < startLine) return true;

    const clean = splitTrailingCarriageReturn(rawLine);
    const rendered = includeLineNumbers === false ? clean : `L${currentLine} ${clean}`;
    const addition = renderedText ? `\n${rendered}` : rendered;
    const appended = appendBoundedText(renderedText, addition, limit);
    renderedText = appended.text;
    selected.push(clean);
    if (appended.truncated) {
      outputTruncated = true;
      stoppedEarly = true;
      return false;
    }
    return true;
  }

  outer: for await (const chunk of stream) {
    if (!chunk) continue;
    buffer += chunk;
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (!processLine(line)) break outer;
      newlineIndex = buffer.indexOf("\n");
    }
  }

  if (!stoppedEarly && buffer.length > 0) {
    processLine(buffer);
  }

  const complete = !stoppedEarly;
  return {
    totalLines: complete ? currentLine : null,
    selected,
    renderedText,
    truncated: outputTruncated,
    complete,
    hasMore: !complete,
    scannedLines: currentLine,
  };
}

async function scanTextChunk(
  absolutePath,
  { offset, length },
  { createReadStream = defaultStreamFactory } = {}
) {
  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeLength = Math.min(normalizePositiveInt(length, MAX_READ_CHUNK_CHARS), MAX_READ_CHUNK_CHARS);
  const stream = createReadStream(absolutePath, {
    encoding: "utf8",
    highWaterMark: STREAM_READ_BUFFER_BYTES,
  });
  let scannedChars = 0;
  let collected = "";
  let stoppedEarly = false;

  for await (const chunk of stream) {
    if (!chunk) continue;
    const probeEnd = safeOffset + safeLength + 1;
    const remaining = probeEnd - scannedChars;
    if (remaining <= 0) {
      stoppedEarly = true;
      break;
    }
    const consumed = chunk.slice(0, remaining);
    const chunkStart = scannedChars;
    scannedChars += consumed.length;
    const sliceStart = Math.max(0, safeOffset - chunkStart);
    if (scannedChars > safeOffset) collected += consumed.slice(sliceStart);
    if (collected.length > safeLength) {
      collected = collected.slice(0, safeLength);
      stoppedEarly = true;
      break;
    }
  }

  const complete = !stoppedEarly;
  return {
    chars: complete ? scannedChars : null,
    scannedChars,
    offset: safeOffset,
    length: safeLength,
    returnedText: collected,
    hasMore: !complete,
    complete,
  };
}

async function readFile(relativePath, { maxChars = MAX_READ_FILE_CHARS } = {}) {
  const resolved = resolveReadableWorkspacePath(relativePath);
  const stat = await fsp.stat(resolved.absolutePath);
  if (!stat.isFile()) throw new Error("Not a file.");

  const scanned = await scanTextFile(resolved.absolutePath, maxChars);
  return {
    path: resolved.displayPath,
    root_alias: resolved.rootAlias,
    bytes: stat.size,
    chars: scanned.chars,
    returned_chars: scanned.text.length,
    total_lines: scanned.totalLines,
    complete: scanned.complete,
    has_more: scanned.hasMore,
    scanned_chars: scanned.scannedChars,
    truncated: scanned.truncated,
    text: scanned.text,
    hint: scanned.hasMore ? "Use read_file_lines or read_file_chunk for precise continuation." : undefined,
  };
}

async function readFileLines(
  relativePath,
  { startLine, endLine, includeLineNumbers = true, maxChars = MAX_READ_LINES_CHARS } = {}
) {
  if (endLine < startLine) throw new Error("end_line must be greater than or equal to start_line.");

  const resolved = resolveReadableWorkspacePath(relativePath);
  const stat = await fsp.stat(resolved.absolutePath);
  if (!stat.isFile()) throw new Error("Not a file.");

  const scanned = await scanTextLines(resolved.absolutePath, {
    startLine,
    endLine,
    includeLineNumbers,
    maxChars,
  });
  const selected = scanned.selected;
  const effectiveStartLine = selected.length > 0
    ? startLine
    : scanned.complete
      ? Math.min(startLine, (scanned.totalLines || 0) + 1)
      : startLine;

  return {
    path: resolved.displayPath,
    root_alias: resolved.rootAlias,
    bytes: stat.size,
    start_line: startLine,
    end_line: endLine,
    effective_start_line: effectiveStartLine,
    effective_end_line: selected.length > 0 ? effectiveStartLine + selected.length - 1 : null,
    total_lines: scanned.totalLines,
    returned_lines: selected.length,
    include_line_numbers: includeLineNumbers,
    returned_chars: scanned.renderedText.length,
    complete: scanned.complete,
    has_more: scanned.hasMore,
    scanned_lines: scanned.scannedLines,
    truncated: scanned.truncated,
    text: scanned.renderedText,
    lines: makeNumberedLines(selected, effectiveStartLine),
  };
}

async function readFileChunk(relativePath, { offset = 0, length = MAX_READ_CHUNK_CHARS } = {}) {
  const resolved = resolveReadableWorkspacePath(relativePath);
  const stat = await fsp.stat(resolved.absolutePath);
  if (!stat.isFile()) throw new Error("Not a file.");

  const scanned = await scanTextChunk(resolved.absolutePath, { offset, length });
  return {
    path: resolved.displayPath,
    root_alias: resolved.rootAlias,
    bytes: stat.size,
    chars: scanned.chars,
    offset: scanned.offset,
    length: scanned.length,
    returned_chars: scanned.returnedText.length,
    next_offset: scanned.offset + scanned.returnedText.length,
    has_more: scanned.hasMore,
    complete: scanned.complete,
    scanned_chars: scanned.scannedChars,
    text: scanned.returnedText,
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
  decodeListCursor,
  encodeListCursor,
  fileInfoFor,
  listDirectory,
  readFile,
  readFileChunk,
  readFileLines,
  scanTextChunk,
  scanTextFile,
  scanTextLines,
  summarizeWorkspacePath,
};
