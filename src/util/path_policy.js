const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_PUBLIC_FS_ROOT = path.join(__dirname, "..", "..", "_public_sandbox");
const DEFAULT_MAX_FILE_BYTES = 512 * 1024;
const DEFAULT_MAX_TEXT_CHARS = 64 * 1024;
const DEFAULT_MAX_LIST_ENTRIES = 200;
const STREAM_READ_BUFFER_BYTES = 64 * 1024;

const DENIED_BASENAMES = new Set([
  ".env",
  ".npmrc",
  ".pypirc",
  ".netrc",
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
]);

const DENIED_EXTENSIONS = new Set([
  ".pem",
  ".key",
  ".pfx",
  ".p12",
  ".crt",
  ".cer",
  ".der",
  ".sqlite",
  ".sqlite3",
  ".db",
  ".kdbx",
  ".ppk",
  ".env",
]);

const ALLOWED_TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".json",
  ".jsonl",
  ".csv",
  ".tsv",
  ".xml",
  ".yaml",
  ".yml",
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".cjs",
]);

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}


function assertPublicFsRootSafe(root) {
  const resolved = path.resolve(root);
  const base = path.basename(resolved).toLowerCase();
  const forbiddenFiles = ["server.js", "SERVER_SPEC.json"];
  const forbiddenDirs = ["src", "tools", "profiles", "_workflow", "_logs", ".git"];
  for (const file of forbiddenFiles) {
    if (fs.existsSync(path.join(resolved, file))) {
      throw new Error(`Unsafe public FS root: contains ${file}.`);
    }
  }
  for (const dir of forbiddenDirs) {
    if (fs.existsSync(path.join(resolved, dir))) {
      throw new Error(`Unsafe public FS root: contains ${dir}.`);
    }
  }
  if (["mcp-tests", "mcp", "work"].includes(base)) {
    throw new Error(`Unsafe public FS root basename: ${base}.`);
  }
  return resolved;
}

function getPublicFsRoot() {
  return assertPublicFsRootSafe(process.env.MCP_TEST_FS_ROOT || DEFAULT_PUBLIC_FS_ROOT);
}

function getPublicFsMaxFileBytes() {
  const parsed = Number(process.env.MCP_TEST_FS_MAX_FILE_BYTES || DEFAULT_MAX_FILE_BYTES);
  if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 5 * 1024 * 1024) {
    return DEFAULT_MAX_FILE_BYTES;
  }
  return parsed;
}

function getPublicFsMaxTextChars() {
  const parsed = Number(process.env.MCP_TEST_FS_MAX_TEXT_CHARS || DEFAULT_MAX_TEXT_CHARS);
  if (!Number.isInteger(parsed) || parsed < 100 || parsed > 1024 * 1024) {
    return DEFAULT_MAX_TEXT_CHARS;
  }
  return parsed;
}

function getPublicFsMaxListEntries() {
  const parsed = Number(process.env.MCP_TEST_FS_MAX_LIST_ENTRIES || DEFAULT_MAX_LIST_ENTRIES);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
    return DEFAULT_MAX_LIST_ENTRIES;
  }
  return parsed;
}

function normalizeRelativePath(input, { allowEmpty = true } = {}) {
  const raw = String(input ?? "").trim().replace(/\\/g, "/");

  if (!raw) {
    if (allowEmpty) return ".";
    throw new Error("Path is required.");
  }

  if (raw.length > 1000) {
    throw new Error("Path is too long.");
  }

  if (raw.includes("\u0000")) {
    throw new Error("Path contains a NUL byte.");
  }

  if (raw.startsWith("/") || raw.startsWith("//")) {
    throw new Error("Absolute paths are not allowed.");
  }

  if (/^[A-Za-z]:/.test(raw)) {
    throw new Error("Drive-letter paths are not allowed.");
  }

  const parts = raw.split("/").filter((part) => part.length > 0 && part !== ".");

  if (!parts.length) {
    return ".";
  }

  for (const part of parts) {
    if (part === "..") {
      throw new Error("Path traversal is not allowed.");
    }

    if (part.startsWith(".") || part.startsWith("_")) {
      throw new Error("Dot and underscore path segments are not allowed in public FS tools.");
    }

    const lower = part.toLowerCase();
    const ext = path.extname(lower);

    if (DENIED_BASENAMES.has(lower) || DENIED_EXTENSIONS.has(ext)) {
      throw new Error("Path refers to denied secret/private file type.");
    }
  }

  return parts.join("/");
}

function resolvePublicPath(input, options = {}) {
  const root = getPublicFsRoot();
  const relative_path = normalizeRelativePath(input, options);
  const absolute_path = path.resolve(root, relative_path === "." ? "" : relative_path);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (absolute_path !== root && !absolute_path.startsWith(rootWithSep)) {
    throw new Error("Resolved path escapes the public FS sandbox.");
  }

  return {
    root,
    relative_path,
    absolute_path,
  };
}

function assertTextFileAllowed(absolutePath) {
  const lower = path.basename(absolutePath).toLowerCase();
  const ext = path.extname(lower);

  if (DENIED_BASENAMES.has(lower) || DENIED_EXTENSIONS.has(ext)) {
    throw new Error("Denied file type.");
  }

  if (!ALLOWED_TEXT_EXTENSIONS.has(ext)) {
    throw new Error(`File extension is not allowed for public text read: ${ext || "(none)"}`);
  }
}

function getSafeStats(input, options = {}) {
  const resolved = resolvePublicPath(input, options);
  let stats;

  try {
    stats = fs.lstatSync(resolved.absolute_path);
  } catch (error) {
    throw new Error(`Path not found: ${resolved.relative_path}`);
  }

  if (stats.isSymbolicLink()) {
    throw new Error("Symbolic links are not allowed in public FS tools.");
  }

  return {
    ...resolved,
    stats,
  };
}

async function hashFileStream(absolutePath) {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(absolutePath, { highWaterMark: STREAM_READ_BUFFER_BYTES });

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

async function fileInfoFor(relativeInput) {
  const item = getSafeStats(relativeInput);
  const { stats } = item;
  const shouldHash = stats.isFile() && stats.size <= getPublicFsMaxFileBytes();
  return {
    path: item.relative_path,
    name: item.relative_path === "." ? "." : path.basename(item.absolute_path),
    kind: stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other",
    size_bytes: stats.size,
    modified_ms: Math.floor(stats.mtimeMs),
    sha256: shouldHash ? await hashFileStream(item.absolute_path) : "",
  };
}

function validatePublicTextFile(relativeInput) {
  const item = getSafeStats(relativeInput, { allowEmpty: false });
  const { stats } = item;

  if (!stats.isFile()) {
    throw new Error("Path is not a file.");
  }

  assertTextFileAllowed(item.absolute_path);

  const maxFileBytes = getPublicFsMaxFileBytes();
  if (stats.size > maxFileBytes) {
    throw new Error(`File exceeds public FS max size: ${stats.size} > ${maxFileBytes}`);
  }

  return item;
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

async function readTextPrefixStream(absolutePath, maxChars) {
  const limit = Math.max(0, Number(maxChars) || getPublicFsMaxTextChars());
  let text = "";
  let truncated = false;
  const stream = fs.createReadStream(absolutePath, {
    encoding: "utf8",
    highWaterMark: STREAM_READ_BUFFER_BYTES,
  });

  for await (const chunk of stream) {
    const appended = appendBoundedText(text, chunk, limit);
    text = appended.text;
    if (appended.truncated) {
      truncated = true;
      break;
    }
  }

  return { text, truncated };
}

async function readBoundedText(relativeInput, { maxChars = getPublicFsMaxTextChars() } = {}) {
  const item = validatePublicTextFile(relativeInput);
  const [prefix, digest] = await Promise.all([
    readTextPrefixStream(item.absolute_path, maxChars),
    hashFileStream(item.absolute_path),
  ]);

  return {
    path: item.relative_path,
    size_bytes: item.stats.size,
    chars: prefix.text.length,
    truncated: prefix.truncated,
    sha256: digest,
    text: prefix.text,
  };
}

async function readPublicLines(
  relativeInput,
  { startLine, endLine, includeLineNumbers = true, maxChars = getPublicFsMaxTextChars() } = {}
) {
  const start = Number(startLine);
  const end = Number(endLine);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    throw new Error("Invalid line range.");
  }

  const item = validatePublicTextFile(relativeInput);
  const limit = Math.max(0, Number(maxChars) || getPublicFsMaxTextChars());
  let text = "";
  let currentLine = 0;
  let buffer = "";
  let truncated = false;

  const stream = fs.createReadStream(item.absolute_path, {
    encoding: "utf8",
    highWaterMark: STREAM_READ_BUFFER_BYTES,
  });

  function addLine(line) {
    const clean = line.endsWith("\r") ? line.slice(0, -1) : line;
    const rendered = includeLineNumbers === false ? clean : `${currentLine}: ${clean}`;
    const addition = text ? `\n${rendered}` : rendered;
    const appended = appendBoundedText(text, addition, limit);
    text = appended.text;
    if (appended.truncated) {
      truncated = true;
      return false;
    }
    return true;
  }

  outer: for await (const chunk of stream) {
    buffer += chunk;
    let newlineIndex = buffer.indexOf("\n");

    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      currentLine += 1;

      if (currentLine >= start && currentLine <= end) {
        if (!addLine(line)) break outer;
      }

      if (currentLine >= end) {
        truncated = true;
        break outer;
      }

      newlineIndex = buffer.indexOf("\n");
    }
  }

  if (!truncated && buffer.length > 0) {
    currentLine += 1;
    if (currentLine >= start && currentLine <= end) {
      addLine(buffer);
    }
  }

  const digest = await hashFileStream(item.absolute_path);
  return {
    path: item.relative_path,
    size_bytes: item.stats.size,
    chars: text.length,
    truncated,
    sha256: digest,
    text,
  };
}

async function readPublicChunk(relativeInput, { offset = 0, length = 4096 } = {}) {
  const startOffset = Number(offset || 0);
  const requestedLength = Number(length || 4096);
  if (!Number.isInteger(startOffset) || !Number.isInteger(requestedLength) || startOffset < 0 || requestedLength < 1) {
    throw new Error("Invalid chunk offset/length.");
  }

  const item = validatePublicTextFile(relativeInput);
  let currentOffset = 0;
  let collected = "";
  let truncated = false;
  const targetLength = requestedLength + 1;

  const stream = fs.createReadStream(item.absolute_path, {
    encoding: "utf8",
    highWaterMark: STREAM_READ_BUFFER_BYTES,
  });

  for await (const chunk of stream) {
    const chunkStart = currentOffset;
    const chunkEnd = currentOffset + chunk.length;
    currentOffset = chunkEnd;

    if (chunkEnd <= startOffset) continue;

    const sliceStart = Math.max(0, startOffset - chunkStart);
    const appended = appendBoundedText(collected, chunk.slice(sliceStart), targetLength);
    collected = appended.text;

    if (collected.length > requestedLength || appended.truncated) {
      truncated = true;
      collected = collected.slice(0, requestedLength);
      break;
    }
  }

  const digest = await hashFileStream(item.absolute_path);
  return {
    path: item.relative_path,
    size_bytes: item.stats.size,
    chars: collected.length,
    truncated,
    sha256: digest,
    text: collected,
  };
}

function listPublicDirectory(relativeInput, { maxEntries = getPublicFsMaxListEntries() } = {}) {
  const item = getSafeStats(relativeInput);

  if (!item.stats.isDirectory()) {
    throw new Error("Path is not a directory.");
  }

  const entries = fs
    .readdirSync(item.absolute_path, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith(".") && !entry.name.startsWith("_"))
    .slice(0, maxEntries)
    .map((entry) => {
      const rel = item.relative_path === "." ? entry.name : `${item.relative_path}/${entry.name}`;
      const stat = fs.lstatSync(path.join(item.absolute_path, entry.name));
      return {
        name: entry.name,
        path: rel,
        kind: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
        size_bytes: stat.size,
        modified_ms: Math.floor(stat.mtimeMs),
      };
    });

  return {
    root: item.root,
    path: item.relative_path,
    entries,
    truncated: entries.length >= maxEntries,
  };
}

function safeError(relativeInput, error) {
  return {
    success: false,
    path: String(relativeInput ?? ""),
    path_sha256: sha256(relativeInput),
    error: error?.message || String(error),
  };
}

function safeArgSummary(value, extra = {}) {
  const text = String(value ?? "");
  return {
    arg_sha256: sha256(text),
    arg_length_chars: text.length,
    arg_length_bytes: Buffer.byteLength(text, "utf8"),
    raw_value_redacted: true,
    ...extra,
  };
}

module.exports = {
  ALLOWED_TEXT_EXTENSIONS,
  assertPublicFsRootSafe,
  DENIED_BASENAMES,
  DENIED_EXTENSIONS,
  DEFAULT_PUBLIC_FS_ROOT,
  fileInfoFor,
  getPublicFsMaxFileBytes,
  getPublicFsMaxListEntries,
  getPublicFsMaxTextChars,
  getPublicFsRoot,
  getSafeStats,
  hashFileStream,
  listPublicDirectory,
  normalizeRelativePath,
  readBoundedText,
  readPublicChunk,
  readPublicLines,
  readTextPrefixStream,
  resolvePublicPath,
  safeArgSummary,
  safeError,
  sha256,
};
