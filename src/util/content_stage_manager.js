"use strict";

const { createHash, randomUUID } = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");

const { STRUCTURED_CONTENT_CHUNK_MAX_CHARS } = require("../schemas/structured_file_tools");
const { createContentStageStore } = require("./content_stage_store");

const DEFAULT_MAX_STAGE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_OWNER_BYTES = 32 * 1024 * 1024;
const DEFAULT_MAX_OWNER_STAGES = 16;
const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000;

function stageError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw stageError(`${name} must be a positive integer.`, "content_stage_config_invalid");
  }
  return parsed;
}

function ownerKey(ownerId) {
  return createHash("sha256")
    .update(String(ownerId || "unknown_client"), "utf8")
    .digest("hex");
}

function hasUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) return true;
      index += 1;
      continue;
    }
    if (code >= 0xDC00 && code <= 0xDFFF) return true;
  }
  return false;
}

function resolveContentStageOwner(context = {}) {
  return String(
    context.authResult?.clientId
      || context.authResult?.client_id
      || "unknown_client"
  );
}

function createContentStageManager(options = {}) {
  const now = options.now || Date.now;
  const createId = options.randomUUID || randomUUID;
  const audit = typeof options.audit === "function" ? options.audit : () => {};
  const limits = Object.freeze({
    maxStageBytes: positiveInteger(options.maxStageBytes, DEFAULT_MAX_STAGE_BYTES, "maxStageBytes"),
    maxOwnerBytes: positiveInteger(options.maxOwnerBytes, DEFAULT_MAX_OWNER_BYTES, "maxOwnerBytes"),
    maxOwnerStages: positiveInteger(options.maxOwnerStages, DEFAULT_MAX_OWNER_STAGES, "maxOwnerStages"),
  });
  const retentionMs = positiveInteger(options.retentionMs, DEFAULT_RETENTION_MS, "retentionMs");
  if (limits.maxOwnerBytes < limits.maxStageBytes) {
    throw stageError("maxOwnerBytes must be at least maxStageBytes.", "content_stage_config_invalid");
  }
  const store = options.store || createContentStageStore({ storageFile: options.storageFile || ":memory:" });

  function emit(event, metadata = {}) {
    try {
      audit({ event, ...metadata });
    } catch {
      // Audit transport failure must not change durable stage state.
    }
  }

  function metadata(record, extra = {}) {
    return {
      stage_id: record.stageId,
      state: record.state,
      next_sequence: record.nextSequence,
      chars: record.charCount,
      bytes: record.byteCount,
      sha256: record.sha256 || null,
      expires_at: new Date(record.expiresAtMs).toISOString(),
      ...extra,
    };
  }

  function prune() {
    const removed = store.pruneExpired(now());
    if (removed.length) emit("content_stages_pruned", { count: removed.length });
    return removed.length;
  }

  function create(ownerId) {
    prune();
    const createdAtMs = now();
    const record = store.create({
      stageId: createId(),
      ownerKey: ownerKey(ownerId),
      createdAtMs,
      expiresAtMs: createdAtMs + retentionMs,
    }, limits);
    emit("content_stage_created", { stage_id: record.stageId, expires_at: metadata(record).expires_at });
    return metadata(record);
  }

  function append(ownerId, stageId, sequence, value) {
    prune();
    const chunk = String(value ?? "");
    if (chunk.length > STRUCTURED_CONTENT_CHUNK_MAX_CHARS) {
      throw stageError(`Content stage chunk exceeds ${STRUCTURED_CONTENT_CHUNK_MAX_CHARS} characters.`, "content_stage_chunk_limit");
    }
    if (hasUnpairedSurrogate(chunk)) {
      throw stageError("Content stage chunk contains an unpaired UTF-16 surrogate.", "content_stage_invalid_utf8");
    }
    if (!Number.isSafeInteger(sequence) || sequence < 0) {
      throw stageError("Content stage sequence must be a non-negative integer.", "content_stage_sequence_invalid");
    }
    const bytes = Buffer.byteLength(chunk, "utf8");
    const updatedAtMs = now();
    const record = store.append(stageId, ownerKey(ownerId), sequence, chunk, {
      chars: chunk.length,
      bytes,
      sha256: createHash("sha256").update(chunk, "utf8").digest("hex"),
    }, limits, updatedAtMs, updatedAtMs + retentionMs);
    emit("content_stage_chunk_appended", {
      stage_id: record.stageId,
      sequence,
      accepted_chars: chunk.length,
      accepted_bytes: bytes,
      total_chars: record.charCount,
      total_bytes: record.byteCount,
    });
    return metadata(record, { accepted_chars: chunk.length, accepted_bytes: bytes });
  }

  function seal(ownerId, stageId, expected = {}) {
    prune();
    const key = ownerKey(ownerId);
    const updatedAtMs = now();
    const record = store.seal(stageId, key, expected, updatedAtMs, updatedAtMs + retentionMs);
    emit("content_stage_sealed", {
      stage_id: record.stageId,
      chars: record.charCount,
      bytes: record.byteCount,
      sha256: record.sha256,
    });
    return metadata(record);
  }

  function status(ownerId, stageId) {
    const record = store.get(stageId, ownerKey(ownerId), now());
    return metadata(record);
  }

  function release(ownerId, stageId) {
    const record = store.release(stageId, ownerKey(ownerId));
    emit("content_stage_released", {
      stage_id: record.stageId,
      state: record.state,
      chars: record.charCount,
      bytes: record.byteCount,
    });
    return { ...metadata(record), state: "released", expires_at: null };
  }

  function openReadStream(ownerId, stageId) {
    const key = ownerKey(ownerId);
    const record = store.get(stageId, key, now());
    if (record.state !== "sealed") {
      throw stageError("Content stage must be sealed before it can be consumed.", "content_stage_not_sealed");
    }
    return Readable.from(store.iterateChunks(stageId, key), { encoding: "utf8" });
  }

  return {
    append,
    close: () => store.close(),
    create,
    limits,
    openReadStream,
    prune,
    release,
    retentionMs,
    seal,
    status,
    storageFile: store.storageFile,
  };
}

let defaultManager = null;

function getDefaultContentStageManager(options = {}) {
  if (!defaultManager) {
    const storageFile = options.storageFile
      || process.env.MCP_CONTENT_STAGE_STORAGE_FILE
      || path.join(os.homedir(), ".romion", "tests_content_stages.sqlite");
    defaultManager = createContentStageManager({ ...options, storageFile });
  }
  return defaultManager;
}

function resolveContentStageManager(context = {}) {
  if (context.contentStageManager) return context.contentStageManager;
  const audit = typeof context.auditLog === "function"
    ? (payload) => {
        const { event, ...details } = payload;
        context.auditLog(event, details);
      }
    : undefined;
  return getDefaultContentStageManager({ audit });
}

function closeDefaultContentStageManager() {
  if (!defaultManager) return;
  defaultManager.close();
  defaultManager = null;
}

module.exports = {
  DEFAULT_MAX_OWNER_BYTES,
  DEFAULT_MAX_OWNER_STAGES,
  DEFAULT_MAX_STAGE_BYTES,
  DEFAULT_RETENTION_MS,
  closeDefaultContentStageManager,
  createContentStageManager,
  getDefaultContentStageManager,
  resolveContentStageManager,
  resolveContentStageOwner,
};
