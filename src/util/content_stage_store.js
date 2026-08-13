"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

function stageError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeStorageFile(storageFile) {
  const value = String(storageFile || ":memory:").trim();
  if (!value) throw stageError("Content stage storage file cannot be empty.", "content_stage_config_invalid");
  return value === ":memory:" ? value : path.resolve(value);
}

function rowToRecord(row) {
  if (!row) return null;
  return {
    stageId: row.stage_id,
    ownerKey: row.owner_key,
    state: row.state,
    createdAtMs: Number(row.created_at_ms),
    updatedAtMs: Number(row.updated_at_ms),
    expiresAtMs: Number(row.expires_at_ms),
    charCount: Number(row.char_count),
    byteCount: Number(row.byte_count),
    nextSequence: Number(row.next_sequence),
    sha256: row.sha256,
  };
}

function createContentStageStore(options = {}) {
  const storageFile = normalizeStorageFile(options.storageFile);
  if (storageFile !== ":memory:") fs.mkdirSync(path.dirname(storageFile), { recursive: true });
  const db = options.database || new DatabaseSync(storageFile, { timeout: 5000 });
  db.exec("PRAGMA foreign_keys=ON");
  db.exec("PRAGMA busy_timeout=5000");
  db.exec("PRAGMA synchronous=FULL");
  if (storageFile !== ":memory:") db.exec("PRAGMA journal_mode=WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_stages (
      stage_id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('open', 'sealed')),
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,
      expires_at_ms INTEGER NOT NULL,
      char_count INTEGER NOT NULL DEFAULT 0,
      byte_count INTEGER NOT NULL DEFAULT 0,
      next_sequence INTEGER NOT NULL DEFAULT 0,
      sha256 TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_content_stages_owner_expiry
      ON content_stages(owner_key, expires_at_ms);
    CREATE TABLE IF NOT EXISTS content_stage_chunks (
      stage_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      content TEXT NOT NULL,
      char_count INTEGER NOT NULL,
      byte_count INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      PRIMARY KEY(stage_id, sequence),
      FOREIGN KEY(stage_id) REFERENCES content_stages(stage_id) ON DELETE CASCADE
    );
  `);

  function transaction(callback) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = callback();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch {}
      throw error;
    }
  }

  function selectOwned(stageId, ownerKey) {
    return rowToRecord(db.prepare(`
      SELECT * FROM content_stages WHERE stage_id=? AND owner_key=?
    `).get(String(stageId || ""), String(ownerKey || "")));
  }

  function requireOwned(stageId, ownerKey) {
    const record = selectOwned(stageId, ownerKey);
    if (!record) throw stageError(`Unknown content stage: ${stageId}`, "content_stage_not_found");
    return record;
  }

  function pruneExpired(nowMs) {
    return transaction(() => {
      const rows = db.prepare("SELECT stage_id FROM content_stages WHERE expires_at_ms<=?").all(nowMs);
      db.prepare("DELETE FROM content_stages WHERE expires_at_ms<=?").run(nowMs);
      return rows.map((row) => row.stage_id);
    });
  }

  function create(record, limits) {
    return transaction(() => {
      db.prepare("DELETE FROM content_stages WHERE expires_at_ms<=?").run(record.createdAtMs);
      const owner = db.prepare(`
        SELECT COUNT(*) AS stage_count, COALESCE(SUM(byte_count), 0) AS byte_count
        FROM content_stages WHERE owner_key=?
      `).get(record.ownerKey);
      if (Number(owner.stage_count) >= limits.maxOwnerStages) {
        throw stageError("Content stage count limit reached for this owner.", "content_stage_count_limit");
      }
      if (Number(owner.byte_count) >= limits.maxOwnerBytes) {
        throw stageError("Content stage byte limit reached for this owner.", "content_stage_owner_size_limit");
      }
      db.prepare(`
        INSERT INTO content_stages (
          stage_id, owner_key, state, created_at_ms, updated_at_ms, expires_at_ms,
          char_count, byte_count, next_sequence, sha256
        ) VALUES (?, ?, 'open', ?, ?, ?, 0, 0, 0, NULL)
      `).run(record.stageId, record.ownerKey, record.createdAtMs, record.createdAtMs, record.expiresAtMs);
      return selectOwned(record.stageId, record.ownerKey);
    });
  }

  function append(stageId, ownerKey, sequence, chunk, chunkStats, limits, updatedAtMs, expiresAtMs) {
    return transaction(() => {
      const current = requireOwned(stageId, ownerKey);
      if (current.state !== "open") {
        throw stageError("Content stage is sealed and cannot accept more chunks.", "content_stage_not_open");
      }
      if (sequence !== current.nextSequence) {
        throw stageError(`Expected content stage sequence ${current.nextSequence}, received ${sequence}.`, "content_stage_sequence_conflict");
      }
      if (current.byteCount + chunkStats.bytes > limits.maxStageBytes) {
        throw stageError("Content stage byte limit exceeded.", "content_stage_size_limit");
      }
      const owner = db.prepare(`
        SELECT COALESCE(SUM(byte_count), 0) AS byte_count
        FROM content_stages WHERE owner_key=?
      `).get(ownerKey);
      if (Number(owner.byte_count) + chunkStats.bytes > limits.maxOwnerBytes) {
        throw stageError("Content stage owner byte limit exceeded.", "content_stage_owner_size_limit");
      }
      db.prepare(`
        INSERT INTO content_stage_chunks (stage_id, sequence, content, char_count, byte_count, sha256)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(stageId, sequence, chunk, chunkStats.chars, chunkStats.bytes, chunkStats.sha256);
      db.prepare(`
        UPDATE content_stages
        SET updated_at_ms=?, expires_at_ms=?, char_count=char_count+?, byte_count=byte_count+?, next_sequence=next_sequence+1
        WHERE stage_id=? AND owner_key=?
      `).run(updatedAtMs, expiresAtMs, chunkStats.chars, chunkStats.bytes, stageId, ownerKey);
      return selectOwned(stageId, ownerKey);
    });
  }

  function seal(stageId, ownerKey, expected, updatedAtMs, expiresAtMs) {
    return transaction(() => {
      const current = requireOwned(stageId, ownerKey);
      if (current.state !== "open") {
        throw stageError("Content stage is already sealed.", "content_stage_not_open");
      }
      const hash = createHash("sha256");
      const chunks = db.prepare(`
        SELECT content FROM content_stage_chunks
        WHERE stage_id=? ORDER BY sequence ASC
      `);
      for (const row of chunks.iterate(stageId)) hash.update(row.content, "utf8");
      const sha256 = hash.digest("hex");
      if (expected.expected_chars !== undefined && Number(expected.expected_chars) !== current.charCount) {
        throw stageError("Content stage character count does not match expected_chars.", "content_stage_integrity_mismatch");
      }
      if (expected.expected_sha256 !== undefined && String(expected.expected_sha256).toLowerCase() !== sha256) {
        throw stageError("Content stage SHA-256 does not match expected_sha256.", "content_stage_integrity_mismatch");
      }
      db.prepare(`
        UPDATE content_stages
        SET state='sealed', sha256=?, updated_at_ms=?, expires_at_ms=?
        WHERE stage_id=? AND owner_key=?
      `).run(sha256, updatedAtMs, expiresAtMs, stageId, ownerKey);
      return selectOwned(stageId, ownerKey);
    });
  }

  function get(stageId, ownerKey, nowMs) {
    pruneExpired(nowMs);
    return requireOwned(stageId, ownerKey);
  }

  function release(stageId, ownerKey) {
    return transaction(() => {
      const current = requireOwned(stageId, ownerKey);
      db.prepare("DELETE FROM content_stages WHERE stage_id=? AND owner_key=?").run(stageId, ownerKey);
      return current;
    });
  }

  function *iterateChunks(stageId, ownerKey) {
    requireOwned(stageId, ownerKey);
    const statement = db.prepare(`
      SELECT content FROM content_stage_chunks
      WHERE stage_id=? ORDER BY sequence ASC
    `);
    for (const row of statement.iterate(stageId)) yield row.content;
  }

  function close() {
    db.close();
  }

  return {
    append,
    close,
    create,
    get,
    iterateChunks,
    pruneExpired,
    release,
    seal,
    storageFile,
  };
}

module.exports = { createContentStageStore };
