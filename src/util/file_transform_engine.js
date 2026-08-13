"use strict";

const { createHash } = require("node:crypto");
const fs = require("node:fs");

const { resolveContentStageManager, resolveContentStageOwner } = require("./content_stage_manager");
const { atomicReplaceFile } = require("./file_transaction");
const {
  DEFAULT_MAX_FILE_BYTES,
  inspectTextFile,
  resolveSelector,
} = require("./file_selectors");
const { safeWorkspacePath } = require("./workspace_roots");
const {
  createBackupIfExists,
  resolveWritableWorkspacePath,
} = require("./workspace_mutation");

const RECEIPT_VERSION = "file-transform-receipt-v1";

function transformError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function hashBuffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function receiptFor(payload) {
  return createHash("sha256")
    .update(RECEIPT_VERSION, "utf8")
    .update("\0", "utf8")
    .update(JSON.stringify(canonicalize(payload)), "utf8")
    .digest("hex");
}

function configuredMaxBytes(context = {}) {
  const value = Number(context.maxFileBytes || process.env.MCP_STRUCTURED_FILE_MAX_BYTES || DEFAULT_MAX_FILE_BYTES);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw transformError("Structured file max byte limit must be a positive integer.", "structured_file_config_invalid");
  }
  return value;
}

function assertWellFormed(value) {
  const text = String(value);
  if (typeof text.isWellFormed === "function" && !text.isWellFormed()) {
    throw transformError("Inline content contains an unpaired UTF-16 surrogate.", "structured_file_invalid_utf8");
  }
  return text;
}

async function *normalizeLineEndings(stream, eol) {
  let pendingCr = false;
  for await (const raw of stream) {
    const chunk = assertWellFormed(Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw));
    let output = "";
    for (const character of chunk) {
      if (pendingCr) {
        output += eol;
        pendingCr = false;
        if (character === "\n") continue;
      }
      if (character === "\r") pendingCr = true;
      else if (character === "\n") output += eol;
      else output += character;
    }
    if (output) yield Buffer.from(output, "utf8");
  }
  if (pendingCr) yield Buffer.from(eol, "utf8");
}

async function measureStream(factory) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of factory()) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8");
    hash.update(buffer);
    bytes += buffer.length;
  }
  return { bytes, sha256: hash.digest("hex") };
}

function normalizedTextFactory(text, eol) {
  return () => normalizeLineEndings([assertWellFormed(text)], eol);
}

async function resolveContentSource(source, targetInfo, context) {
  if (!source || typeof source !== "object") {
    throw transformError("Transform operation content source is required.", "file_transform_content_invalid");
  }
  if (Object.hasOwn(source, "inline")) {
    const factory = normalizedTextFactory(source.inline, targetInfo.dominantEol);
    const measured = await measureStream(factory);
    return {
      kind: "inline",
      fingerprint: measured.sha256,
      bytes: measured.bytes,
      stream: factory,
      checks: [],
    };
  }
  if (Object.hasOwn(source, "stage_id")) {
    const manager = resolveContentStageManager(context);
    const ownerId = resolveContentStageOwner(context);
    const status = manager.status(ownerId, source.stage_id);
    if (status.state !== "sealed") {
      throw transformError("Content stage must be sealed before transform preview.", "content_stage_not_sealed");
    }
    const factory = () => normalizeLineEndings(manager.openReadStream(ownerId, source.stage_id), targetInfo.dominantEol);
    const measured = await measureStream(factory);
    return {
      kind: "stage",
      stageId: source.stage_id,
      stageSha256: status.sha256,
      fingerprint: measured.sha256,
      bytes: measured.bytes,
      stream: factory,
      checks: [{ kind: "stage", manager, ownerId, stageId: source.stage_id, expectedSha256: status.sha256 }],
    };
  }
  if (source.file && typeof source.file === "object") {
    const resolved = safeWorkspacePath(source.file.path);
    const sourceInfo = await inspectTextFile(resolved.absolutePath, { maxFileBytes: configuredMaxBytes(context) });
    const expected = String(source.file.expected_file_sha256 || "").toLowerCase();
    if (!expected || sourceInfo.fileSha256 !== expected) {
      throw transformError("Content source file SHA-256 does not match expected_file_sha256.", "file_transform_source_changed");
    }
    const range = await resolveSelector(resolved.absolutePath, source.file.selector, {
      fileInfo: sourceInfo,
      maxFileBytes: configuredMaxBytes(context),
      markdownResolver: context.markdownResolver,
    });
    const factory = () => range.endByte <= range.startByte
      ? []
      : fs.createReadStream(resolved.absolutePath, { start: range.startByte, end: range.endByte - 1 });
    return {
      kind: "file",
      path: resolved.displayPath,
      absolutePath: resolved.absolutePath,
      fingerprint: range.rangeSha256,
      bytes: range.bytes,
      stream: factory,
      checks: [{ kind: "file", absolutePath: resolved.absolutePath, expectedSha256: sourceInfo.fileSha256 }],
    };
  }
  throw transformError("Transform content must use exactly one of inline, stage_id, or file.", "file_transform_content_invalid");
}

function operationRange(kind, selected, sourceBytes) {
  if (kind === "replace" || kind === "delete") return { start: selected.startByte, end: selected.endByte };
  if (kind === "insert_before") return { start: selected.startByte, end: selected.startByte };
  if (kind === "insert_after") return { start: selected.endByte, end: selected.endByte };
  if (kind === "append") return { start: sourceBytes, end: sourceBytes };
  throw transformError(`Unsupported transform operation: ${kind}`, "file_transform_operation_invalid");
}

function assertNonOverlapping(operations) {
  for (let index = 1; index < operations.length; index += 1) {
    const previous = operations[index - 1];
    const current = operations[index];
    const overlaps = current.start < previous.end;
    const ambiguousSharedPoint = current.start === previous.start
      && (current.start === current.end || previous.start === previous.end);
    if (overlaps || ambiguousSharedPoint) {
      throw transformError("Transform operations overlap or share an ambiguous insertion point.", "file_transform_overlap");
    }
  }
}

async function compileTransform(input = {}, context = {}) {
  const resolved = resolveWritableWorkspacePath(input.path, { allowProtected: input.allow_protected === true });
  const maxBytes = configuredMaxBytes(context);
  const sourceInfo = await inspectTextFile(resolved.absolutePath, { maxFileBytes: maxBytes });
  const expectedFileSha256 = String(input.expected_file_sha256 || "").toLowerCase();
  if (!expectedFileSha256 || expectedFileSha256 !== sourceInfo.fileSha256) {
    throw transformError("Target file changed or expected_file_sha256 is missing.", "file_transform_source_changed");
  }
  if (!Array.isArray(input.operations) || input.operations.length < 1) {
    throw transformError("At least one transform operation is required.", "file_transform_operation_invalid");
  }
  const compiled = [];
  const checks = [];
  for (let ordinal = 0; ordinal < input.operations.length; ordinal += 1) {
    const operation = input.operations[ordinal] || {};
    const kind = String(operation.kind || "");
    const selected = kind === "append"
      ? { startByte: sourceInfo.bytes, endByte: sourceInfo.bytes, bytes: 0, rangeSha256: hashBuffer(Buffer.alloc(0)), matches: 1 }
      : await resolveSelector(resolved.absolutePath, operation.selector, {
          fileInfo: sourceInfo,
          maxFileBytes: maxBytes,
          markdownResolver: context.markdownResolver,
        });
    const range = operationRange(kind, selected, sourceInfo.bytes);
    const content = kind === "delete" ? null : await resolveContentSource(operation.content, sourceInfo, context);
    if (content) checks.push(...content.checks);
    compiled.push({
      ordinal,
      kind,
      start: range.start,
      end: range.end,
      selected,
      content,
    });
  }
  compiled.sort((left, right) => left.start - right.start || left.ordinal - right.ordinal);
  assertNonOverlapping(compiled);
  const bytesAfter = compiled.reduce(
    (total, operation) => total - (operation.end - operation.start) + (operation.content?.bytes || 0),
    sourceInfo.bytes
  );
  if (bytesAfter > maxBytes) {
    throw transformError(`Structured file result exceeds ${maxBytes} bytes.`, "structured_file_size_limit");
  }
  const receiptPayload = {
    path: resolved.displayPath,
    source_sha256: sourceInfo.fileSha256,
    source_bytes: sourceInfo.bytes,
    operations: compiled.map((operation) => ({
      ordinal: operation.ordinal,
      kind: operation.kind,
      start_byte: operation.start,
      end_byte: operation.end,
      range_sha256: operation.selected.rangeSha256,
      content_kind: operation.content?.kind || null,
      content_fingerprint: operation.content?.fingerprint || null,
      content_bytes: operation.content?.bytes || 0,
      stage_sha256: operation.content?.stageSha256 || null,
      source_path: operation.content?.path || null,
    })),
  };
  return {
    resolved,
    sourceInfo,
    operations: compiled,
    checks,
    bytesAfter,
    receiptPayload,
    receipt: receiptFor(receiptPayload),
    maxBytes,
  };
}

function previewPayload(compiled) {
  return {
    status: "preview",
    path: compiled.resolved.displayPath,
    source_sha256: compiled.sourceInfo.fileSha256,
    source_bytes: compiled.sourceInfo.bytes,
    bytes_after: compiled.bytesAfter,
    delta_bytes: compiled.bytesAfter - compiled.sourceInfo.bytes,
    operation_count: compiled.operations.length,
    operations: compiled.receiptPayload.operations,
    receipt: compiled.receipt,
  };
}

async function verifyChecks(compiled) {
  const currentTarget = await inspectTextFile(compiled.resolved.absolutePath, { maxFileBytes: compiled.maxBytes });
  if (currentTarget.fileSha256 !== compiled.sourceInfo.fileSha256) {
    throw transformError("Target file changed after transform preparation.", "file_transform_source_changed");
  }
  for (const check of compiled.checks) {
    if (check.kind === "file") {
      const current = await inspectTextFile(check.absolutePath, { maxFileBytes: compiled.maxBytes });
      if (current.fileSha256 !== check.expectedSha256) {
        throw transformError("Content source file changed during transform.", "file_transform_source_changed");
      }
    } else if (check.kind === "stage") {
      const current = check.manager.status(check.ownerId, check.stageId);
      if (current.state !== "sealed" || current.sha256 !== check.expectedSha256) {
        throw transformError("Content stage changed during transform.", "file_transform_source_changed");
      }
    }
  }
}

async function prepareFileTransform(input = {}, context = {}) {
  return previewPayload(await compileTransform(input, context));
}

async function commitFileTransform(input = {}, context = {}) {
  const compiled = await compileTransform(input, context);
  const suppliedReceipt = String(input.receipt || "").trim();
  if (!suppliedReceipt || suppliedReceipt !== compiled.receipt) {
    throw transformError("Transform receipt does not match current source, selectors, and content.", "file_transform_receipt_invalid");
  }
  const transaction = await atomicReplaceFile({
    targetPath: compiled.resolved.absolutePath,
    mode: compiled.sourceInfo.mode,
    maxBytes: compiled.maxBytes,
    dependencies: context.fileTransactionDependencies,
    createBackup: () => createBackupIfExists(compiled.resolved),
    verifyBeforeRename: () => verifyChecks(compiled),
    async writeContent(writer) {
      let cursor = 0;
      for (const operation of compiled.operations) {
        await writer.copyRange(compiled.resolved.absolutePath, cursor, operation.start);
        if (operation.content) await writer.writeStream(operation.content.stream());
        cursor = operation.end;
      }
      await writer.copyRange(compiled.resolved.absolutePath, cursor, compiled.sourceInfo.bytes);
    },
  });
  return {
    status: "committed",
    path: compiled.resolved.displayPath,
    source_sha256: compiled.sourceInfo.fileSha256,
    result_sha256: transaction.sha256,
    bytes_before: compiled.sourceInfo.bytes,
    bytes_after: transaction.bytes,
    delta_bytes: transaction.bytes - compiled.sourceInfo.bytes,
    operation_count: compiled.operations.length,
    receipt: compiled.receipt,
    backup: transaction.backup,
    warnings: transaction.warning ? [transaction.warning] : [],
  };
}

module.exports = {
  RECEIPT_VERSION,
  commitFileTransform,
  prepareFileTransform,
};
