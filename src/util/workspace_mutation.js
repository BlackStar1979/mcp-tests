"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const { PRIMARY_WORK_ROOT_ALIAS, safeWorkspacePath } = require("./workspace_roots");

const MAX_WRITE_BYTES = Number(process.env.MCP_TEST_MAX_WRITE_BYTES || 5 * 1024 * 1024);
const PROTECTED_SEGMENTS = new Set([
  ".git",
  ".hg",
  ".svn",
  ".secrets",
  "node_modules",
  ".mcp_trash",
  ".mcp_backups",
  "_backups",
]);

function toPosix(value) {
  return String(value || "").replaceAll("\\", "/");
}

function makeDisplayPath(rootAlias, rootRelativePath) {
  const rel = toPosix(rootRelativePath || ".");
  if (!rel || rel === ".") {
    return rootAlias === PRIMARY_WORK_ROOT_ALIAS ? "." : `@${rootAlias}`;
  }
  return rootAlias === PRIMARY_WORK_ROOT_ALIAS ? rel : `@${rootAlias}/${rel}`;
}

function assertWritableTarget(resolved, { allowProtected = false } = {}) {
  const parts = toPosix(resolved.rootRelativePath || ".").split("/").filter(Boolean);
  for (const part of parts) {
    if (PROTECTED_SEGMENTS.has(part) && !allowProtected) {
      throw new Error(`Protected path denied: ${part}`);
    }
  }
  return resolved;
}

function resolveWritableWorkspacePath(relativePath, options = {}) {
  return assertWritableTarget(safeWorkspacePath(relativePath), options);
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function pathExists(absolutePath, fsImpl = fs) {
  try {
    await fsImpl.stat(absolutePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function createBackupIfExists(resolvedTarget) {
  if (!(await pathExists(resolvedTarget.absolutePath))) {
    return null;
  }
  const parsed = path.posix.parse(toPosix(resolvedTarget.rootRelativePath || "."));
  const backupRelative = path.posix.join(
    ".mcp_backups",
    parsed.dir || "",
    `${parsed.name}__backup_${stamp()}${parsed.ext || ""}`
  );
  const backupAbsolute = path.resolve(resolvedTarget.rootPath, backupRelative);
  await fs.mkdir(path.dirname(backupAbsolute), { recursive: true });
  await fs.cp(resolvedTarget.absolutePath, backupAbsolute, { recursive: true, force: true });
  return makeDisplayPath(resolvedTarget.rootAlias, backupRelative);
}

async function writeFile(relativePath, content, { allowProtected = false } = {}) {
  const resolved = resolveWritableWorkspacePath(relativePath, { allowProtected });
  const bytes = Buffer.byteLength(String(content), "utf8");
  if (bytes > MAX_WRITE_BYTES) {
    throw new Error(`Write blocked: content is larger than ${MAX_WRITE_BYTES} bytes.`);
  }
  const backup = await createBackupIfExists(resolved);
  await fs.mkdir(path.dirname(resolved.absolutePath), { recursive: true });
  await fs.writeFile(resolved.absolutePath, String(content), "utf8");
  return {
    status: "written",
    path: resolved.displayPath,
    bytes,
    backup,
  };
}

async function appendFile(relativePath, content, { allowProtected = false } = {}) {
  const resolved = resolveWritableWorkspacePath(relativePath, { allowProtected });
  const bytes = Buffer.byteLength(String(content), "utf8");
  if (bytes > MAX_WRITE_BYTES) {
    throw new Error(`Append blocked: content is larger than ${MAX_WRITE_BYTES} bytes.`);
  }
  const backup = await createBackupIfExists(resolved);
  await fs.mkdir(path.dirname(resolved.absolutePath), { recursive: true });
  await fs.appendFile(resolved.absolutePath, String(content), "utf8");
  return {
    status: "appended",
    path: resolved.displayPath,
    bytes,
    backup,
  };
}

async function copyPath(fromPath, toPath, { allowProtected = false } = {}) {
  const fromResolved = safeWorkspacePath(fromPath);
  const toResolved = resolveWritableWorkspacePath(toPath, { allowProtected });
  const backup = await createBackupIfExists(toResolved);
  await fs.mkdir(path.dirname(toResolved.absolutePath), { recursive: true });
  await fs.cp(fromResolved.absolutePath, toResolved.absolutePath, { recursive: true, force: true });
  return {
    status: "copied",
    from: fromResolved.displayPath,
    to: toResolved.displayPath,
    backup,
  };
}

async function movePath(fromPath, toPath, { allowProtected = false } = {}) {
  const fromResolved = resolveWritableWorkspacePath(fromPath, { allowProtected });
  const toResolved = resolveWritableWorkspacePath(toPath, { allowProtected });
  if (await pathExists(toResolved.absolutePath)) {
    throw new Error("Destination already exists. move_path does not overwrite existing targets.");
  }
  await fs.mkdir(path.dirname(toResolved.absolutePath), { recursive: true });
  await fs.rename(fromResolved.absolutePath, toResolved.absolutePath);
  return {
    status: "moved",
    from: fromResolved.displayPath,
    to: toResolved.displayPath,
  };
}

async function deletePath(relativePath, { allowProtected = false } = {}, { fsImpl = fs } = {}) {
  const resolved = resolveWritableWorkspacePath(relativePath, { allowProtected });
  if (resolved.rootRelativePath === ".") {
    throw new Error("Refusing to delete root.");
  }
  const parsed = path.posix.parse(toPosix(resolved.rootRelativePath));
  const trashRelative = path.posix.join(
    ".mcp_trash",
    parsed.dir || "",
    `${parsed.name}__deleted_${stamp()}${parsed.ext || ""}`
  );
  const trashAbsolute = path.resolve(resolved.rootPath, trashRelative);
  await fsImpl.mkdir(path.dirname(trashAbsolute), { recursive: true });
  await fsImpl.rename(resolved.absolutePath, trashAbsolute);

  const metadataRelative = `${trashRelative}.json`;
  const metadataAbsolute = path.resolve(resolved.rootPath, metadataRelative);
  try {
    await fsImpl.writeFile(
      metadataAbsolute,
      JSON.stringify(
        {
          deleted_at: new Date().toISOString(),
          original_path: resolved.displayPath,
          original_root_alias: resolved.rootAlias,
          original_root_relative_path: toPosix(resolved.rootRelativePath),
          trash_path: makeDisplayPath(resolved.rootAlias, trashRelative),
        },
        null,
        2
      ),
      "utf8"
    );
  } catch (error) {
    try {
      await fsImpl.mkdir(path.dirname(resolved.absolutePath), { recursive: true });
      await fsImpl.rename(trashAbsolute, resolved.absolutePath);
    } catch (rollbackError) {
      error.message = `${error.message} [rollback failed: ${rollbackError?.message || String(rollbackError)}]`;
    }
    throw error;
  }

  return {
    status: "moved_to_trash",
    from: resolved.displayPath,
    to: makeDisplayPath(resolved.rootAlias, trashRelative),
    metadata: makeDisplayPath(resolved.rootAlias, metadataRelative),
  };
}

async function restorePath(trashPath, { destination, overwrite = false, allowProtected = false } = {}, { fsImpl = fs } = {}) {
  const trashResolved = safeWorkspacePath(trashPath);
  const trashRelative = toPosix(trashResolved.rootRelativePath || ".");
  if (!trashRelative.startsWith(".mcp_trash/")) {
    throw new Error("restore_path only accepts paths inside .mcp_trash.");
  }

  const metadataAbsolute = `${trashResolved.absolutePath}.json`;
  let destinationPath = destination;
  if (!destinationPath) {
    let metadata;
    try {
      metadata = JSON.parse(await fsImpl.readFile(metadataAbsolute, "utf8"));
    } catch {
      throw new Error("Destination omitted and restore metadata was not found.");
    }
    destinationPath = metadata.original_path;
  }

  const destResolved = resolveWritableWorkspacePath(destinationPath, { allowProtected });
  if (await pathExists(destResolved.absolutePath, fsImpl)) {
    if (!overwrite) {
      throw new Error("Destination already exists. Set overwrite=true to replace it.");
    }
    await createBackupIfExists(destResolved);
    await fsImpl.rm(destResolved.absolutePath, { recursive: true, force: true });
  }

  await fsImpl.mkdir(path.dirname(destResolved.absolutePath), { recursive: true });
  await fsImpl.rename(trashResolved.absolutePath, destResolved.absolutePath);
  const warnings = [];
  try {
    await fsImpl.rm(metadataAbsolute, { force: true });
  } catch (error) {
    warnings.push(`restore metadata cleanup failed: ${error?.message || String(error)}`);
  }

  return {
    status: "restored",
    from: trashResolved.displayPath,
    to: destResolved.displayPath,
    warnings,
  };
}

function detectDominantLineEnding(text) {
  const value = String(text || "");
  const crlf = (value.match(/\r\n/g) || []).length;
  const withoutCrlf = value.replace(/\r\n/g, "");
  const lf = (withoutCrlf.match(/\n/g) || []).length;
  const cr = (withoutCrlf.match(/\r/g) || []).length;
  if (crlf >= lf && crlf >= cr && crlf > 0) return "\r\n";
  if (lf >= cr && lf > 0) return "\n";
  if (cr > 0) return "\r";
  return "\n";
}

function normalizeLineEndings(text) {
  return String(text || "").replace(/\r\n|\r|\n/g, "\n");
}

function convertLineEndings(text, eol) {
  return normalizeLineEndings(text).replace(/\n/g, eol);
}

function normalizeWithBoundaryMap(text) {
  const source = String(text || "");
  let normalized = "";
  const boundary = [0];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === "\r") {
      normalized += "\n";
      index += source[index + 1] === "\n" ? 2 : 1;
      boundary.push(index);
      continue;
    }
    if (char === "\n") {
      normalized += "\n";
      index += 1;
      boundary.push(index);
      continue;
    }
    normalized += char;
    index += 1;
    boundary.push(index);
  }
  return { normalized, boundary };
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while (true) {
    const found = text.indexOf(needle, index);
    if (found === -1) return count;
    count += 1;
    index = found + needle.length;
  }
}

function findSingleAnchorRange(source, anchor) {
  const exactMatches = countOccurrences(source, anchor);
  const mapped = normalizeWithBoundaryMap(source);
  const normalizedAnchor = normalizeLineEndings(anchor);
  const normalizedMatches = countOccurrences(mapped.normalized, normalizedAnchor);
  if (normalizedMatches !== 1) {
    throw new Error(
      "Patch blocked: anchor must match exactly once; exact=" + exactMatches
      + "; line_end_normalized=" + normalizedMatches
      + "; detected_eol=" + JSON.stringify(detectDominantLineEnding(source)) + "."
    );
  }
  const normalizedStart = mapped.normalized.indexOf(normalizedAnchor);
  const normalizedEnd = normalizedStart + normalizedAnchor.length;
  return {
    start: mapped.boundary[normalizedStart],
    end: mapped.boundary[normalizedEnd],
    matches: normalizedMatches,
  };
}

function applyTextPatch(source, { mode, anchor, content }) {
  const range = findSingleAnchorRange(source, anchor);
  const patchContent = convertLineEndings(content, detectDominantLineEnding(source));
  if (mode === "before") return source.slice(0, range.start) + patchContent + source.slice(range.start);
  if (mode === "after") return source.slice(0, range.end) + patchContent + source.slice(range.end);
  if (mode === "replace") return source.slice(0, range.start) + patchContent + source.slice(range.end);
  throw new Error(`Unsupported patch mode: ${mode}`);
}

function countPatchAnchorMatches(source, anchor) {
  return findSingleAnchorRange(source, anchor).matches;
}

async function editFilePatch(relativePath, { anchor, content, mode = "replace", dry_run = true, allow_protected = false, require_markers = [] } = {}) {
  const resolved = resolveWritableWorkspacePath(relativePath, { allowProtected: allow_protected });
  const stat = await fs.stat(resolved.absolutePath);
  if (!stat.isFile()) {
    throw new Error("Not a file.");
  }
  const original = await fs.readFile(resolved.absolutePath, "utf8");
  const matches = countPatchAnchorMatches(original, anchor);
  const patched = applyTextPatch(original, { mode, anchor, content });
  for (const marker of require_markers || []) {
    if (!patched.includes(marker)) {
      throw new Error(`Patch blocked: required marker missing after patch: ${marker}`);
    }
  }
  const bytesBefore = Buffer.byteLength(original, "utf8");
  const bytesAfter = Buffer.byteLength(patched, "utf8");
  if (bytesAfter > MAX_WRITE_BYTES) {
    throw new Error(`Patch blocked: patched file is larger than ${MAX_WRITE_BYTES} bytes.`);
  }
  const payload = {
    status: dry_run ? "dry_run" : "patched",
    path: resolved.displayPath,
    mode,
    anchor_matches: matches,
    bytes_before: bytesBefore,
    bytes_after: bytesAfter,
    delta_bytes: bytesAfter - bytesBefore,
    dry_run: Boolean(dry_run),
    backup: null,
  };
  if (dry_run) {
    return payload;
  }
  payload.backup = await createBackupIfExists(resolved);
  await fs.writeFile(resolved.absolutePath, patched, "utf8");
  return payload;
}

module.exports = {
  MAX_WRITE_BYTES,
  appendFile,
  applyTextPatch,
  copyPath,
  countPatchAnchorMatches,
  createBackupIfExists,
  deletePath,
  editFilePatch,
  movePath,
  resolveWritableWorkspacePath,
  restorePath,
  writeFile,
};
