"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

function contentHash(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function cacheFile(logDir) {
  return path.join(logDir, ".mcp-agent-embeddings.sqlite");
}

function initialize(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS memory_embedding_cache (
      content_hash TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      vector BLOB NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (content_hash, provider, model)
    );
  `);
}

function encodeVector(vector) {
  return Buffer.from(new Float32Array(vector).buffer);
}

function decodeVector(value, dimensions) {
  const bytes = Buffer.from(value);
  if (bytes.byteLength !== dimensions * Float32Array.BYTES_PER_ELEMENT) return null;
  return Array.from(new Float32Array(bytes.buffer, bytes.byteOffset, dimensions));
}

function storeCachedEmbedding({ logDir, text, provider, model, dimensions, vector }) {
  fs.mkdirSync(logDir, { recursive: true });
  const db = new DatabaseSync(cacheFile(logDir));
  try {
    initialize(db);
    db.prepare(`
      INSERT INTO memory_embedding_cache
        (content_hash, provider, model, dimensions, vector, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(content_hash, provider, model) DO UPDATE SET
        dimensions = excluded.dimensions,
        vector = excluded.vector,
        created_at = excluded.created_at
    `).run(
      contentHash(text),
      provider,
      model,
      dimensions,
      encodeVector(vector),
      new Date().toISOString(),
    );
  } finally {
    db.close();
  }
}

function loadCachedEmbeddings({ logDir, texts, provider, model, dimensions }) {
  const filePath = cacheFile(logDir);
  if (!fs.existsSync(filePath)) return new Map();

  const hashes = [...new Set((texts || []).map(contentHash))];
  if (hashes.length === 0) return new Map();

  const db = new DatabaseSync(filePath, { readOnly: true });
  const output = new Map();
  try {
    const statement = db.prepare(`
      SELECT vector
      FROM memory_embedding_cache
      WHERE content_hash = ? AND provider = ? AND model = ? AND dimensions = ?
    `);
    for (const hash of hashes) {
      const row = statement.get(hash, provider, model, dimensions);
      const vector = row ? decodeVector(row.vector, dimensions) : null;
      if (vector) output.set(hash, vector);
    }
  } finally {
    db.close();
  }
  return output;
}

module.exports = {
  cacheFile,
  contentHash,
  loadCachedEmbeddings,
  storeCachedEmbedding,
};
