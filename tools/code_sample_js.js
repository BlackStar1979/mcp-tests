const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  CODE_SAMPLE_JS_INPUT_SCHEMA,
  CODE_SAMPLE_JS_OUTPUT_SCHEMA,
  IDENTIFIER_PATTERN,
  READ_ONLY_CODE_SAMPLE_ANNOTATIONS,
} = require("../src/schemas/code_sample_js_tool");

const TOOL_NAME = "code_sample_js";

const WORKSPACE_ROOT = path.resolve(
  process.env.MCP_TEST_CODE_SAMPLE_ROOT || path.join(__dirname, "..")
);

const MAX_FILE_BYTES = Number(process.env.MCP_TEST_CODE_SAMPLE_MAX_FILE_BYTES || 1024 * 1024);
const DEFAULT_MAX_CHARS = Number(process.env.MCP_TEST_CODE_SAMPLE_DEFAULT_MAX_CHARS || 12000);
const HARD_MAX_CHARS = Number(process.env.MCP_TEST_CODE_SAMPLE_HARD_MAX_CHARS || 50000);

const ALLOWED_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
]);

const DENIED_BASENAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".npmrc",
  ".yarnrc",
]);

const DENIED_EXTENSIONS = new Set([
  ".pem",
  ".key",
  ".pfx",
  ".p12",
  ".crt",
  ".cer",
  ".der",
  ".kdbx",
  ".sqlite",
  ".db",
]);

function sha256(value) {
  return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function classifySensitiveMarkers(value) {
  const text = String(value ?? "");
  const lower = text.toLowerCase();

  return {
    has_mcp: /\bmcp\b/i.test(text),
    has_token: /token/i.test(text),
    has_localhost: lower.includes("localhost"),
    has_loopback: lower.includes("127.0.0.1") || lower.includes("::1"),
    has_bearer: /\bbearer\b/i.test(text),
    has_authorization: /authorization/i.test(text),
    has_secret: /secret/i.test(text),
    has_key: /\bkey\b/i.test(text) || /api[_ -]?key/i.test(text),
    has_password: /password/i.test(text) || /\bpwd\b/i.test(text),
  };
}

function makeOutput({
  success,
  filePath = "",
  identifier = "",
  extract = "auto",
  type = "error",
  startLine = 0,
  endLine = 0,
  code = "",
  length = 0,
  truncated = false,
  confidence = "none",
  note,
}) {
  const output = {
    success: Boolean(success),
    path: String(filePath || ""),
    identifier: String(identifier || ""),
    extract: String(extract || "auto"),
    type: String(type || "error"),
    startLine: Number(startLine) || 0,
    endLine: Number(endLine) || 0,
    code: String(code || ""),
    length: Number(length) || 0,
    truncated: Boolean(truncated),
    confidence: String(confidence || "none"),
  };

  if (note) {
    output.note = String(note);
  }

  return output;
}

function normalizeExtract(value) {
  const extract = String(value || "auto").trim().toLowerCase();

  if (["auto", "block", "line"].includes(extract)) {
    return extract;
  }

  return "auto";
}

function clampMaxChars(value) {
  const parsed = Number(value || DEFAULT_MAX_CHARS);

  if (!Number.isInteger(parsed)) {
    return DEFAULT_MAX_CHARS;
  }

  return Math.min(Math.max(parsed, 500), HARD_MAX_CHARS);
}

function normalizeOccurrence(value) {
  const parsed = Number(value || 1);

  if (!Number.isInteger(parsed)) {
    return 1;
  }

  return Math.min(Math.max(parsed, 1), 50);
}

function isAllowedSearch(value) {
  return new RegExp(IDENTIFIER_PATTERN).test(String(value || ""));
}

function rootWithTrailingSeparator(rootPath) {
  return rootPath.endsWith(path.sep) ? rootPath : `${rootPath}${path.sep}`;
}

function assertPathInsideRoot(candidatePath, rootPath, message) {
  const rootWithSep = rootWithTrailingSeparator(rootPath);

  if (candidatePath !== rootPath && !candidatePath.startsWith(rootWithSep)) {
    throw new Error(message);
  }
}

function getWorkspaceRootRealPath() {
  return fs.realpathSync(WORKSPACE_ROOT);
}

function assertRealPathInsideRoot(resolvedPath, rootRealPath) {
  const fileRealPath = fs.realpathSync(resolvedPath);

  assertPathInsideRoot(
    fileRealPath,
    rootRealPath,
    "Real path escapes configured workspace root."
  );

  return fileRealPath;
}

function assertNoSymlinkAtTarget(resolvedPath) {
  const lstat = fs.lstatSync(resolvedPath);

  if (lstat.isSymbolicLink()) {
    throw new Error("Symbolic links are not allowed.");
  }
}

function resolveWorkspacePath(rawPath) {
  const raw = String(rawPath || "").trim();

  if (!raw) {
    throw new Error("Missing path.");
  }

  if (path.isAbsolute(raw)) {
    throw new Error("Absolute paths are not allowed.");
  }

  if (raw.includes("\0")) {
    throw new Error("NUL byte in path is not allowed.");
  }

  const resolved = path.resolve(WORKSPACE_ROOT, raw);

  assertPathInsideRoot(
    resolved,
    WORKSPACE_ROOT,
    "Path escapes configured workspace root."
  );

  const base = path.basename(resolved).toLowerCase();
  const ext = path.extname(resolved).toLowerCase();

  if (DENIED_BASENAMES.has(base)) {
    throw new Error(`Denied file name: ${base}`);
  }

  if (DENIED_EXTENSIONS.has(ext)) {
    throw new Error(`Denied file extension: ${ext}`);
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported file extension: ${ext || "(none)"}`);
  }

  return resolved;
}

function stripStringsAndCommentsForBraceScan(line, state) {
  let out = "";

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (state.blockComment) {
      if (ch === "*" && next === "/") {
        state.blockComment = false;
        i++;
      }

      out += " ";
      continue;
    }

    if (state.string) {
      if (ch === "\\" && i + 1 < line.length) {
        out += "  ";
        i++;
        continue;
      }

      if (ch === state.string) {
        state.string = null;
      }

      out += " ";
      continue;
    }

    if (ch === "/" && next === "*") {
      state.blockComment = true;
      out += "  ";
      i++;
      continue;
    }

    if (ch === "/" && next === "/") {
      out += " ".repeat(line.length - i);
      break;
    }

    if (ch === "\"" || ch === "'" || ch === "`") {
      state.string = ch;
      out += " ";
      continue;
    }

    out += ch;
  }

  return out;
}

function findCandidateLine(lines, search, occurrence = 1) {
  const escaped = escapeRegExp(search);

  const declarationPatterns = [
    new RegExp(`\\bfunction\\s+${escaped}\\b`),
    new RegExp(`\\bclass\\s+${escaped}\\b`),
    new RegExp(`\\b(?:const|let|var)\\s+${escaped}\\b`),
    new RegExp(`\\b${escaped}\\s*[:=]\\s*(?:async\\s*)?(?:function\\b|\\([^)]*\\)\\s*=>|[^,;]+)`),
    new RegExp(`\\b${escaped}\\s*\\([^)]*\\)\\s*\\{`),
  ];

  const fallback = new RegExp(`\\b${escaped}\\b`, "i");
  const matches = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (declarationPatterns.some((rx) => rx.test(line))) {
      matches.push(i);
    }
  }

  if (matches.length < occurrence) {
    for (let i = 0; i < lines.length; i++) {
      if (fallback.test(lines[i]) && !matches.includes(i)) {
        matches.push(i);
      }
    }
  }

  return matches[occurrence - 1] ?? -1;
}

function codeSampleJsFromText({ script, search, extract = "auto", occurrence = 1, max_chars = 12000, filePath = "" }) {
  const mode = normalizeExtract(extract);
  const safeOccurrence = normalizeOccurrence(occurrence);
  const safeMaxChars = clampMaxChars(max_chars);

  if (!script || typeof script !== "string") {
    return makeOutput({
      success: false,
      filePath,
      identifier: search,
      extract: mode,
      note: "Missing script string.",
    });
  }

  if (!search || typeof search !== "string") {
    return makeOutput({
      success: false,
      filePath,
      identifier: "",
      extract: mode,
      note: "Missing search string.",
    });
  }

  if (!isAllowedSearch(search)) {
    return makeOutput({
      success: false,
      filePath,
      identifier: search,
      extract: mode,
      note: "Search must be an identifier-like value, not an arbitrary phrase.",
    });
  }

  const lines = script.split(/\r?\n/);
  const startLineIndex = findCandidateLine(lines, search, safeOccurrence);

  if (startLineIndex === -1) {
    return makeOutput({
      success: false,
      filePath,
      identifier: search,
      extract: mode,
      type: "not_found",
      note: `Identifier not found: ${search}`,
    });
  }

  if (mode === "line") {
    const code = lines[startLineIndex].trim();
    const truncated = code.length > safeMaxChars;

    return makeOutput({
      success: true,
      filePath,
      identifier: search,
      extract: mode,
      type: "line",
      startLine: startLineIndex + 1,
      endLine: startLineIndex + 1,
      code: truncated ? code.slice(0, safeMaxChars) : code,
      length: 1,
      truncated,
      confidence: "heuristic",
      note: truncated ? "Output truncated by max_chars." : undefined,
    });
  }

  let braceCount = 0;
  let foundOpeningBrace = false;
  const blockLines = [];
  const scanState = {
    string: null,
    blockComment: false,
  };

  for (let i = startLineIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    blockLines.push(rawLine);

    const scanLine = stripStringsAndCommentsForBraceScan(rawLine, scanState);

    for (const ch of scanLine) {
      if (ch === "{") {
        braceCount++;
        foundOpeningBrace = true;
      } else if (ch === "}") {
        braceCount--;
      }
    }

    const joined = blockLines.join("\n");

    if (joined.length >= safeMaxChars) {
      return makeOutput({
        success: true,
        filePath,
        identifier: search,
        extract: mode,
        type: foundOpeningBrace ? "partial_block" : "partial_expression",
        startLine: startLineIndex + 1,
        endLine: i + 1,
        code: joined.slice(0, safeMaxChars),
        length: blockLines.length,
        truncated: true,
        confidence: "heuristic",
        note: "Output truncated by max_chars.",
      });
    }

    if (foundOpeningBrace && braceCount <= 0) {
      return makeOutput({
        success: true,
        filePath,
        identifier: search,
        extract: mode,
        type: "block",
        startLine: startLineIndex + 1,
        endLine: i + 1,
        code: joined,
        length: blockLines.length,
        truncated: false,
        confidence: "heuristic",
      });
    }

    if (!foundOpeningBrace) {
      const trimmed = rawLine.trim();

      if (
        trimmed.endsWith(";") ||
        trimmed.endsWith(",") ||
        (i > startLineIndex && /^\s*$/.test(rawLine))
      ) {
        return makeOutput({
          success: true,
          filePath,
          identifier: search,
          extract: mode,
          type: "single_line_expression",
          startLine: startLineIndex + 1,
          endLine: i + 1,
          code: joined,
          length: blockLines.length,
          truncated: false,
          confidence: "heuristic",
        });
      }
    }
  }

  const joined = blockLines.join("\n");

  return makeOutput({
    success: true,
    filePath,
    identifier: search,
    extract: mode,
    type: foundOpeningBrace ? "partial_block" : "partial_expression",
    startLine: startLineIndex + 1,
    endLine: lines.length,
    code: joined.slice(0, safeMaxChars),
    length: blockLines.length,
    truncated: joined.length > safeMaxChars,
    confidence: "low",
    note: "Reached end of file before complete block was detected.",
  });
}

function codeSampleJsFromPath(args = {}) {
  const requestedPath = String(args.path || "").trim();
  const search = String(args.search || "").trim();
  const extract = normalizeExtract(args.extract);
  const occurrence = normalizeOccurrence(args.occurrence);
  const maxChars = clampMaxChars(args.max_chars);

  try {
    if (!isAllowedSearch(search)) {
      return makeOutput({
        success: false,
        filePath: requestedPath,
        identifier: search,
        extract,
        note: "Search must be an identifier-like value, not an arbitrary phrase.",
      });
    }

    const resolved = resolveWorkspacePath(requestedPath);
    const rootRealPath = getWorkspaceRootRealPath();

    assertNoSymlinkAtTarget(resolved);

    const realPath = assertRealPathInsideRoot(resolved, rootRealPath);
    const stat = fs.statSync(realPath);

    if (!stat.isFile()) {
      throw new Error("Path is not a file.");
    }

    if (stat.size > MAX_FILE_BYTES) {
      throw new Error(`File too large: ${stat.size} bytes.`);
    }

    const script = fs.readFileSync(realPath, "utf8");
    const relativePath = path.relative(rootRealPath, realPath).replace(/\\/g, "/");

    return codeSampleJsFromText({
      script,
      search,
      extract,
      occurrence,
      max_chars: maxChars,
      filePath: relativePath,
    });
  } catch (error) {
    return makeOutput({
      success: false,
      filePath: requestedPath,
      identifier: search,
      extract,
      type: "error",
      note: error?.message || String(error),
    });
  }
}

function summarizeArgs(args = {}) {
  const rawPath = String(args.path || "");
  const rawSearch = String(args.search || "");

  return {
    arg_name: "path+search",
    path_sha256: sha256(rawPath),
    path_length_chars: rawPath.length,
    search_sha256: sha256(rawSearch),
    search_length_chars: rawSearch.length,
    extract: normalizeExtract(args.extract),
    occurrence: normalizeOccurrence(args.occurrence),
    max_chars: clampMaxChars(args.max_chars),
    flags: classifySensitiveMarkers(rawSearch),
  };
}

function resultStats(output = {}) {
  return {
    result_count: output.success ? 1 : 0,
    result_chars: String(output.code || "").length,
    result_type: output.type || null,
    result_start_line: Number(output.startLine) || 0,
    result_end_line: Number(output.endLine) || 0,
    result_truncated: Boolean(output.truncated),
    result_success: Boolean(output.success),
  };
}

const codeSampleJsTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Code sample JS/TS",
    description:
      "Read-only JS/TS sampler. Extracts a function/class/object/constant block or line from a workspace file without executing code.",
    inputSchema: CODE_SAMPLE_JS_INPUT_SCHEMA,
    outputSchema: CODE_SAMPLE_JS_OUTPUT_SCHEMA,
    annotations: READ_ONLY_CODE_SAMPLE_ANNOTATIONS,
  },
  execute: codeSampleJsFromPath,
  summarizeArgs,
  resultStats,
};

module.exports = {
  codeSampleJsTool,
  codeSampleJsFromPath,
  codeSampleJsFromText,
};