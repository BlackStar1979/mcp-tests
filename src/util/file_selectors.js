"use strict";

const { createHash } = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");

const DEFAULT_CHUNK_SIZE = 64 * 1024;
const DEFAULT_MAX_FILE_BYTES = 256 * 1024 * 1024;

function selectorError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function maxFileBytes(options = {}) {
  const value = Number(options.maxFileBytes || process.env.MCP_STRUCTURED_FILE_MAX_BYTES || DEFAULT_MAX_FILE_BYTES);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw selectorError("Structured file max byte limit must be a positive integer.", "structured_file_config_invalid");
  }
  return value;
}

function chunkSize(options = {}) {
  const value = Number(options.chunkSize || DEFAULT_CHUNK_SIZE);
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_CHUNK_SIZE;
}

async function assertRegularFile(absolutePath, options = {}) {
  const stat = await fsp.lstat(absolutePath);
  if (stat.isSymbolicLink()) {
    throw selectorError("Structured file operations do not follow symbolic links.", "structured_file_symlink_denied");
  }
  if (!stat.isFile()) throw selectorError("Structured file target is not a regular file.", "structured_file_not_file");
  if (stat.size > maxFileBytes(options)) {
    throw selectorError(`Structured file exceeds ${maxFileBytes(options)} bytes.`, "structured_file_size_limit");
  }
  return stat;
}

async function inspectTextFile(absolutePath, options = {}) {
  const stat = await assertRegularFile(absolutePath, options);
  const hash = createHash("sha256");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let first = Buffer.alloc(0);
  let crlf = 0;
  let lf = 0;
  let cr = 0;
  let pendingCr = false;
  let lineBreaks = 0;
  try {
    for await (const chunk of fs.createReadStream(absolutePath, { highWaterMark: chunkSize(options) })) {
      hash.update(chunk);
      decoder.decode(chunk, { stream: true });
      if (first.length < 3) first = Buffer.concat([first, chunk.subarray(0, 3 - first.length)]);
      for (const byte of chunk) {
        if (pendingCr) {
          if (byte === 0x0A) {
            crlf += 1;
            lineBreaks += 1;
            pendingCr = false;
            continue;
          }
          cr += 1;
          lineBreaks += 1;
          pendingCr = false;
        }
        if (byte === 0x0D) pendingCr = true;
        else if (byte === 0x0A) {
          lf += 1;
          lineBreaks += 1;
        }
      }
    }
    if (pendingCr) {
      cr += 1;
      lineBreaks += 1;
    }
    decoder.decode();
  } catch (error) {
    if (error?.code === "ERR_ENCODING_INVALID_ENCODED_DATA") {
      throw selectorError("Structured file is not valid UTF-8.", "structured_file_invalid_utf8");
    }
    if (error?.code) throw error;
    throw selectorError("Structured file is not valid UTF-8.", "structured_file_invalid_utf8");
  }
  const dominantEol = crlf >= lf && crlf >= cr && crlf > 0
    ? "\r\n"
    : lf >= cr && lf > 0
      ? "\n"
      : cr > 0
        ? "\r"
        : "\n";
  return {
    absolutePath,
    bytes: stat.size,
    mode: stat.mode,
    mtimeMs: stat.mtimeMs,
    fileSha256: hash.digest("hex"),
    hasUtf8Bom: first.length >= 3 && first[0] === 0xEF && first[1] === 0xBB && first[2] === 0xBF,
    dominantEol,
    totalLines: stat.size === 0 ? 0 : lineBreaks + 1,
  };
}

async function readByte(absolutePath, offset) {
  const handle = await fsp.open(absolutePath, "r");
  try {
    const buffer = Buffer.alloc(1);
    const { bytesRead } = await handle.read(buffer, 0, 1, offset);
    return bytesRead ? buffer[0] : null;
  } finally {
    await handle.close();
  }
}

async function assertUtf8Boundary(absolutePath, offset, size) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > size) {
    throw selectorError("Byte selector is outside the file.", "file_selector_range_invalid");
  }
  if (offset === 0 || offset === size) return;
  const byte = await readByte(absolutePath, offset);
  if (byte !== null && (byte & 0xC0) === 0x80) {
    throw selectorError("Byte selector splits a UTF-8 code point.", "file_selector_utf8_boundary");
  }
}

async function hashRange(absolutePath, startByte, endByte, options = {}) {
  const hash = createHash("sha256");
  if (endByte <= startByte) return hash.digest("hex");
  for await (const chunk of fs.createReadStream(absolutePath, {
    start: startByte,
    end: endByte - 1,
    highWaterMark: chunkSize(options),
  })) hash.update(chunk);
  return hash.digest("hex");
}

async function resolveLineRange(absolutePath, selector, size, options = {}) {
  const startLine = Number(selector.start_line);
  const endLine = Number(selector.end_line);
  if (!Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine) || startLine < 1 || endLine < startLine) {
    throw selectorError("Line selector requires 1-based start_line <= end_line.", "file_selector_range_invalid");
  }
  if (size === 0) {
    throw selectorError("Line selector cannot target an empty file.", "file_selector_range_invalid");
  }
  let currentLine = 1;
  let startByte = startLine === 1 ? 0 : null;
  let endByte = null;
  let offset = 0;
  let pendingCr = false;
  for await (const chunk of fs.createReadStream(absolutePath, { highWaterMark: chunkSize(options) })) {
    for (let index = 0; index < chunk.length; index += 1) {
      const byte = chunk[index];
      const absolute = offset + index;
      if (pendingCr) {
        if (byte === 0x0A) {
          currentLine += 1;
          const nextStart = absolute + 1;
          if (currentLine === startLine) startByte = nextStart;
          if (currentLine === endLine + 1) endByte = nextStart;
          pendingCr = false;
          if (endByte !== null) break;
          continue;
        }
        currentLine += 1;
        if (currentLine === startLine) startByte = absolute;
        if (currentLine === endLine + 1) endByte = absolute;
        pendingCr = false;
        if (endByte !== null) break;
      }
      if (byte === 0x0D) pendingCr = true;
      else if (byte === 0x0A) {
        currentLine += 1;
        const nextStart = absolute + 1;
        if (currentLine === startLine) startByte = nextStart;
        if (currentLine === endLine + 1) endByte = nextStart;
        if (endByte !== null) break;
      }
    }
    offset += chunk.length;
    if (endByte !== null) break;
  }
  if (pendingCr && endByte === null) {
    currentLine += 1;
    if (currentLine === startLine) startByte = size;
    if (currentLine === endLine + 1) endByte = size;
  }
  if (startByte === null || startByte > size) {
    throw selectorError("Line selector starts after end of file.", "file_selector_range_invalid");
  }
  if (endLine > currentLine) {
    throw selectorError("Line selector ends after end of file.", "file_selector_range_invalid");
  }
  if (endByte === null) endByte = size;
  return { startByte, endByte, lineStart: startLine, lineEnd: endLine, matches: 1 };
}

async function resolveAnchorRange(absolutePath, selector, options = {}) {
  const text = String(selector.text || "");
  if (!text) throw selectorError("Anchor selector text cannot be empty.", "file_selector_anchor_invalid");
  const needle = Buffer.from(text, "utf8");
  const occurrence = Number(selector.occurrence || 1);
  const expectedMatches = Number(selector.expected_matches || 1);
  if (!Number.isSafeInteger(occurrence) || occurrence < 1 || !Number.isSafeInteger(expectedMatches) || expectedMatches < 1) {
    throw selectorError("Anchor selector occurrence and expected_matches must be positive integers.", "file_selector_anchor_invalid");
  }
  let carry = Buffer.alloc(0);
  let processed = 0;
  let nextAllowedStart = 0;
  let matches = 0;
  let selectedStart = null;
  for await (const chunk of fs.createReadStream(absolutePath, { highWaterMark: chunkSize(options) })) {
    const combined = carry.length ? Buffer.concat([carry, chunk]) : chunk;
    const baseOffset = processed - carry.length;
    let searchAt = 0;
    while (searchAt <= combined.length - needle.length) {
      const found = combined.indexOf(needle, searchAt);
      if (found < 0) break;
      const absolute = baseOffset + found;
      if (absolute >= nextAllowedStart) {
        matches += 1;
        if (matches === occurrence) selectedStart = absolute;
        nextAllowedStart = absolute + needle.length;
      }
      searchAt = found + Math.max(1, needle.length);
    }
    processed += chunk.length;
    const carryBytes = Math.min(Math.max(0, needle.length - 1), combined.length);
    carry = carryBytes ? combined.subarray(combined.length - carryBytes) : Buffer.alloc(0);
  }
  if (matches !== expectedMatches) {
    throw selectorError(`Anchor selector expected ${expectedMatches} matches, found ${matches}.`, "file_selector_match_count");
  }
  if (selectedStart === null) {
    throw selectorError(`Anchor occurrence ${occurrence} was not found.`, "file_selector_occurrence_missing");
  }
  const selectedEnd = selectedStart + needle.length;
  if (selector.include_anchor === false) {
    return { startByte: selectedEnd, endByte: selectedEnd, lineStart: null, lineEnd: null, matches };
  }
  return { startByte: selectedStart, endByte: selectedEnd, lineStart: null, lineEnd: null, matches };
}

async function resolveSelector(absolutePath, selector = {}, options = {}) {
  const info = options.fileInfo || await inspectTextFile(absolutePath, options);
  const kind = String(selector.kind || "");
  let range;
  if (kind === "bytes") {
    const startByte = Number(selector.start_byte);
    const endByte = Number(selector.end_byte);
    if (!Number.isSafeInteger(startByte) || !Number.isSafeInteger(endByte) || endByte < startByte || endByte > info.bytes) {
      throw selectorError("Byte selector requires 0 <= start_byte <= end_byte <= file size.", "file_selector_range_invalid");
    }
    await assertUtf8Boundary(absolutePath, startByte, info.bytes);
    await assertUtf8Boundary(absolutePath, endByte, info.bytes);
    range = { startByte, endByte, lineStart: null, lineEnd: null, matches: 1 };
  } else if (kind === "lines") {
    range = await resolveLineRange(absolutePath, selector, info.bytes, options);
  } else if (kind === "anchor") {
    range = await resolveAnchorRange(absolutePath, selector, options);
  } else if (kind === "eof") {
    range = { startByte: info.bytes, endByte: info.bytes, lineStart: info.totalLines, lineEnd: info.totalLines, matches: 1 };
  } else if (kind === "markdown_section") {
    if (typeof options.markdownResolver !== "function") {
      throw selectorError("Markdown section selectors require the Markdown structure resolver.", "file_selector_markdown_unavailable");
    }
    range = await options.markdownResolver(absolutePath, selector, { fileInfo: info });
    if (!range || !Number.isSafeInteger(range.startByte) || !Number.isSafeInteger(range.endByte)) {
      throw selectorError("Markdown resolver returned an invalid range.", "file_selector_markdown_invalid");
    }
    await assertUtf8Boundary(absolutePath, range.startByte, info.bytes);
    await assertUtf8Boundary(absolutePath, range.endByte, info.bytes);
  } else {
    throw selectorError(`Unsupported file selector kind: ${kind || "(empty)"}`, "file_selector_kind_invalid");
  }
  const rangeSha256 = await hashRange(absolutePath, range.startByte, range.endByte, options);
  if (selector.expected_sha256 && String(selector.expected_sha256).toLowerCase() !== rangeSha256) {
    throw selectorError("Selected range SHA-256 does not match expected_sha256.", "file_selector_hash_mismatch");
  }
  return {
    ...range,
    bytes: range.endByte - range.startByte,
    rangeSha256,
    fileSha256: info.fileSha256,
    fileBytes: info.bytes,
    dominantEol: info.dominantEol,
    hasUtf8Bom: info.hasUtf8Bom,
  };
}

async function readRange(absolutePath, startByte, endByte) {
  if (endByte <= startByte) return Buffer.alloc(0);
  const length = endByte - startByte;
  const handle = await fsp.open(absolutePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    let offset = 0;
    while (offset < length) {
      const result = await handle.read(buffer, offset, length - offset, startByte + offset);
      if (!result.bytesRead) break;
      offset += result.bytesRead;
    }
    return buffer.subarray(0, offset);
  } finally {
    await handle.close();
  }
}

async function moveToUtf8Boundary(absolutePath, offset, size) {
  let cursor = Math.max(0, Math.min(offset, size));
  while (cursor < size) {
    const byte = await readByte(absolutePath, cursor);
    if (byte === null || (byte & 0xC0) !== 0x80) break;
    cursor += 1;
  }
  return cursor;
}

async function readSelectorContext(absolutePath, range, options = {}) {
  const beforeChars = Math.max(0, Math.min(Number(options.beforeChars || 0), 4096));
  const afterChars = Math.max(0, Math.min(Number(options.afterChars || 0), 4096));
  const selectedMaxChars = Math.max(1, Math.min(Number(options.selectedMaxChars || 8192), 8192));
  const size = Number(range.fileBytes ?? (await fsp.stat(absolutePath)).size);
  const beforeStart = await moveToUtf8Boundary(absolutePath, range.startByte - beforeChars * 4, size);
  const afterEnd = await moveToUtf8Boundary(absolutePath, Math.min(size, range.endByte + afterChars * 4), size);
  const selectedReadEnd = await moveToUtf8Boundary(
    absolutePath,
    Math.min(range.endByte, range.startByte + selectedMaxChars * 4),
    size
  );
  const before = (await readRange(absolutePath, beforeStart, range.startByte)).toString("utf8").slice(-beforeChars);
  const selectedText = (await readRange(absolutePath, range.startByte, selectedReadEnd)).toString("utf8");
  const selected = selectedText.slice(0, selectedMaxChars);
  const after = (await readRange(absolutePath, range.endByte, afterEnd)).toString("utf8").slice(0, afterChars);
  return {
    before,
    selected,
    after,
    truncated: beforeStart > 0 || afterEnd < size || selectedReadEnd < range.endByte || selectedText.length > selectedMaxChars,
  };
}

module.exports = {
  DEFAULT_MAX_FILE_BYTES,
  assertRegularFile,
  hashRange,
  inspectTextFile,
  readSelectorContext,
  resolveSelector,
};
