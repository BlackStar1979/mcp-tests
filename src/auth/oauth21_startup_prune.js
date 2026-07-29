"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const STARTUP_PRUNE_VERSION = "test-mcp-oauth21-startup-prune-v1";
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DEAD_CLIENT_MIN_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_BACKUPS = 7;
const REQUIRED_TABLES = [
  "oauth21_clients",
  "oauth21_access_tokens",
  "oauth21_refresh_tokens",
  "oauth21_used_refresh_tokens",
];

function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
}

function emitAudit(onAudit, warnLogger, event, data) {
  if (typeof onAudit !== "function") return;
  try {
    onAudit(event, data);
  } catch (error) {
    warnLogger("OAUTH21_STARTUP_PRUNE_AUDIT_FAILED:", error?.message || String(error));
  }
}

function tableExists(db, tableName) {
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?",
  ).get(tableName));
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) return fallback;
  return parsed;
}

function maintenanceValue(db, key) {
  const row = db.prepare(
    "SELECT value FROM oauth21_maintenance WHERE key = ?",
  ).get(key);
  return row ? String(row.value || "") : "";
}

function candidateCounts(db, cutoffMs) {
  const orphanCondition = `
    COALESCE(client_id, '') <> ''
    AND NOT EXISTS (
      SELECT 1 FROM oauth21_clients AS clients
      WHERE clients.client_id = tokens.client_id
    )
  `;
  const count = (sql, ...params) => Number(db.prepare(sql).get(...params).count || 0);
  return {
    clients: count(`
      SELECT COUNT(*) AS count
      FROM oauth21_clients AS clients
      WHERE clients.updated_at <= ?
        AND NOT EXISTS (SELECT 1 FROM oauth21_access_tokens WHERE client_id = clients.client_id)
        AND NOT EXISTS (SELECT 1 FROM oauth21_refresh_tokens WHERE client_id = clients.client_id)
        AND NOT EXISTS (SELECT 1 FROM oauth21_used_refresh_tokens WHERE client_id = clients.client_id)
    `, cutoffMs),
    access_tokens: count(`
      SELECT COUNT(*) AS count FROM oauth21_access_tokens AS tokens WHERE ${orphanCondition}
    `),
    refresh_tokens: count(`
      SELECT COUNT(*) AS count FROM oauth21_refresh_tokens AS tokens WHERE ${orphanCondition}
    `),
    used_refresh_tokens: count(`
      SELECT COUNT(*) AS count FROM oauth21_used_refresh_tokens AS tokens WHERE ${orphanCondition}
    `),
  };
}

function totalCandidates(counts) {
  return Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
}

function createLogicalBackup(db, backupPath) {
  db.prepare("ATTACH DATABASE ? AS rollback").run(backupPath);
  try {
    db.exec(`
      CREATE TABLE rollback.oauth21_clients (
        client_id TEXT PRIMARY KEY,
        client_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE rollback.oauth21_access_tokens (
        token TEXT PRIMARY KEY,
        token_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        client_id TEXT,
        grant_id TEXT
      );
      CREATE TABLE rollback.oauth21_refresh_tokens (
        token TEXT PRIMARY KEY,
        token_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        client_id TEXT,
        grant_id TEXT
      );
      CREATE TABLE rollback.oauth21_used_refresh_tokens (
        token TEXT PRIMARY KEY,
        token_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        client_id TEXT,
        grant_id TEXT,
        replay_until INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE rollback.oauth21_maintenance (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO rollback.oauth21_clients SELECT * FROM main.oauth21_clients;
      INSERT INTO rollback.oauth21_access_tokens SELECT * FROM main.oauth21_access_tokens;
      INSERT INTO rollback.oauth21_refresh_tokens SELECT * FROM main.oauth21_refresh_tokens;
      INSERT INTO rollback.oauth21_used_refresh_tokens SELECT * FROM main.oauth21_used_refresh_tokens;
      INSERT INTO rollback.oauth21_maintenance SELECT * FROM main.oauth21_maintenance;
    `);
    const integrity = String(
      db.prepare("PRAGMA rollback.integrity_check").get().integrity_check || "",
    );
    if (integrity !== "ok") {
      throw new Error(`rollback_backup_integrity_${integrity || "unknown"}`);
    }
  } catch (error) {
    try { db.exec("DETACH DATABASE rollback"); } catch (_) {}
    throw error;
  }
}

function deleteCandidates(db, cutoffMs) {
  const orphanCondition = `
    COALESCE(client_id, '') <> ''
    AND NOT EXISTS (
      SELECT 1 FROM oauth21_clients AS clients
      WHERE clients.client_id = tokens.client_id
    )
  `;
  const changes = (result) => Number(result?.changes || 0);
  const deleted = {
    access_tokens: changes(db.prepare(`
      DELETE FROM oauth21_access_tokens AS tokens WHERE ${orphanCondition}
    `).run()),
    refresh_tokens: changes(db.prepare(`
      DELETE FROM oauth21_refresh_tokens AS tokens WHERE ${orphanCondition}
    `).run()),
    used_refresh_tokens: changes(db.prepare(`
      DELETE FROM oauth21_used_refresh_tokens AS tokens WHERE ${orphanCondition}
    `).run()),
    clients: changes(db.prepare(`
      DELETE FROM oauth21_clients AS clients
      WHERE clients.updated_at <= ?
        AND NOT EXISTS (SELECT 1 FROM oauth21_access_tokens WHERE client_id = clients.client_id)
        AND NOT EXISTS (SELECT 1 FROM oauth21_refresh_tokens WHERE client_id = clients.client_id)
        AND NOT EXISTS (SELECT 1 FROM oauth21_used_refresh_tokens WHERE client_id = clients.client_id)
    `).run(cutoffMs)),
  };
  return {
    clients: deleted.clients,
    access_tokens: deleted.access_tokens,
    refresh_tokens: deleted.refresh_tokens,
    used_refresh_tokens: deleted.used_refresh_tokens,
  };
}

function removeOldBackups(backupDir, maxBackups, warnLogger) {
  try {
    const backups = fs.readdirSync(backupDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".rollback.sqlite"))
      .map((entry) => {
        const filePath = path.join(backupDir, entry.name);
        return { filePath, prefix: entry.name.slice(0, -".rollback.sqlite".length), mtimeMs: fs.statSync(filePath).mtimeMs };
      })
      .sort((left, right) => right.mtimeMs - left.mtimeMs);
    for (const backup of backups.slice(maxBackups)) {
      for (const suffix of [".rollback.sqlite", ".rollback-receipt.json", ".apply-receipt.json"]) {
        fs.rmSync(path.join(backupDir, `${backup.prefix}${suffix}`), { force: true });
      }
    }
  } catch (error) {
    warnLogger("OAUTH21_STARTUP_PRUNE_RETENTION_FAILED:", error?.message || String(error));
  }
}

function runOAuth21StartupPrune({
  storageFile,
  backupDir,
  nowMs = Date.now(),
  intervalMs = DEFAULT_INTERVAL_MS,
  deadClientMinAgeMs = DEFAULT_DEAD_CLIENT_MIN_AGE_MS,
  maxBackups = DEFAULT_MAX_BACKUPS,
  onAudit,
  warnLogger = console.warn,
  writeReceipt = writeJsonAtomic,
} = {}) {
  const resolvedStorageFile = path.resolve(String(storageFile || ""));
  const resolvedBackupDir = path.resolve(String(backupDir || ""));
  const auditBase = { storage_file: resolvedStorageFile };
  if (!storageFile || !fs.existsSync(resolvedStorageFile)) {
    const result = { success: true, status: "storage_missing", deleted: null };
    emitAudit(onAudit, warnLogger, "oauth21_startup_prune_skipped", { ...auditBase, reason: result.status });
    return result;
  }
  if (!backupDir) {
    const result = { success: false, status: "backup_dir_required", deleted: null };
    emitAudit(onAudit, warnLogger, "oauth21_startup_prune_failed", { ...auditBase, reason: result.status });
    return result;
  }

  const effectiveIntervalMs = boundedInteger(intervalMs, DEFAULT_INTERVAL_MS, 60 * 60 * 1000, 7 * 86400 * 1000);
  const effectiveMinAgeMs = boundedInteger(
    deadClientMinAgeMs,
    DEFAULT_DEAD_CLIENT_MIN_AGE_MS,
    86400 * 1000,
    90 * 86400 * 1000,
  );
  const effectiveMaxBackups = boundedInteger(maxBackups, DEFAULT_MAX_BACKUPS, 1, 30);
  const db = new DatabaseSync(resolvedStorageFile);
  let attachedBackup = false;
  let backupPath = "";
  let rollbackReceiptPath = "";
  let applyReceiptPath = "";
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    if (!REQUIRED_TABLES.every((tableName) => tableExists(db, tableName))) {
      const result = { success: true, status: "storage_uninitialized", deleted: null };
      emitAudit(onAudit, warnLogger, "oauth21_startup_prune_skipped", { ...auditBase, reason: result.status });
      return result;
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS oauth21_maintenance (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    const lastSuccessAt = Number(maintenanceValue(db, "startup_prune_last_success_at") || 0);
    if (lastSuccessAt > 0 && nowMs - lastSuccessAt < effectiveIntervalMs) {
      const result = {
        success: true,
        status: "interval_not_elapsed",
        deleted: null,
        last_success_at: lastSuccessAt,
      };
      emitAudit(onAudit, warnLogger, "oauth21_startup_prune_skipped", {
        ...auditBase,
        reason: result.status,
        last_success_at: lastSuccessAt,
      });
      return result;
    }

    fs.mkdirSync(resolvedBackupDir, { recursive: true });
    const cutoffMs = nowMs - effectiveMinAgeMs;
    db.exec("BEGIN IMMEDIATE");
    const candidates = candidateCounts(db, cutoffMs);
    if (totalCandidates(candidates) === 0) {
      db.prepare(`
        INSERT INTO oauth21_maintenance (key, value, updated_at)
        VALUES ('startup_prune_last_success_at', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(String(nowMs), nowMs);
      db.exec("COMMIT");
      const result = { success: true, status: "no_candidates", deleted: candidates };
      emitAudit(onAudit, warnLogger, "oauth21_startup_prune_completed", {
        ...auditBase,
        status: result.status,
        deleted: candidates,
      });
      return result;
    }

    const operationId = `oauth21-startup-prune-${nowMs}-${crypto.randomBytes(4).toString("hex")}`;
    backupPath = path.join(resolvedBackupDir, `${operationId}.rollback.sqlite`);
    rollbackReceiptPath = path.join(resolvedBackupDir, `${operationId}.rollback-receipt.json`);
    applyReceiptPath = path.join(resolvedBackupDir, `${operationId}.apply-receipt.json`);
    createLogicalBackup(db, backupPath);
    attachedBackup = true;
    const rollbackReceipt = {
      version: STARTUP_PRUNE_VERSION,
      mode: "startup-prune-rollback-receipt",
      operation_id: operationId,
      created_at: new Date(nowMs).toISOString(),
      storage_file: resolvedStorageFile,
      backup_path: backupPath,
      candidate_counts: candidates,
      restore_requires_stopped_runtime: true,
    };
    writeReceipt(rollbackReceiptPath, rollbackReceipt);

    const deleted = deleteCandidates(db, cutoffMs);
    db.prepare(`
      INSERT INTO oauth21_maintenance (key, value, updated_at)
      VALUES ('startup_prune_last_success_at', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(String(nowMs), nowMs);
    db.prepare(`
      INSERT INTO oauth21_maintenance (key, value, updated_at)
      VALUES ('startup_prune_last_operation_id', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(operationId, nowMs);
    db.exec("COMMIT");
    db.exec("DETACH DATABASE rollback");
    attachedBackup = false;

    let receiptError = "";
    try {
      writeReceipt(applyReceiptPath, {
        version: STARTUP_PRUNE_VERSION,
        mode: "startup-prune-apply-receipt",
        operation_id: operationId,
        applied_at: new Date(nowMs).toISOString(),
        storage_file: resolvedStorageFile,
        backup_path: backupPath,
        rollback_receipt_path: rollbackReceiptPath,
        candidate_counts: candidates,
        deletion_counts: deleted,
      });
    } catch (error) {
      receiptError = error?.message || String(error);
      warnLogger("OAUTH21_STARTUP_PRUNE_RECEIPT_FAILED:", receiptError);
      emitAudit(onAudit, warnLogger, "oauth21_startup_prune_receipt_failed", {
        ...auditBase,
        operation_id: operationId,
        error_message: receiptError,
      });
    }
    removeOldBackups(resolvedBackupDir, effectiveMaxBackups, warnLogger);
    const result = {
      success: true,
      status: "applied",
      deleted,
      operation_id: operationId,
      backup_path: backupPath,
      rollback_receipt_path: rollbackReceiptPath,
      apply_receipt_path: applyReceiptPath,
      apply_receipt_written: !receiptError,
      apply_receipt_error: receiptError,
    };
    emitAudit(onAudit, warnLogger, "oauth21_startup_prune_applied", {
      ...auditBase,
      operation_id: operationId,
      deleted,
      backup_path: backupPath,
    });
    return result;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch (_) {}
    if (attachedBackup) {
      try { db.exec("DETACH DATABASE rollback"); } catch (_) {}
    }
    const status = backupPath ? "prune_failed" : "backup_failed";
    emitAudit(onAudit, warnLogger, "oauth21_startup_prune_failed", {
      ...auditBase,
      reason: status,
      error_message: error?.message || String(error),
    });
    return {
      success: false,
      status,
      error: error?.message || String(error),
      deleted: null,
      backup_path: backupPath,
      rollback_receipt_path: rollbackReceiptPath,
      apply_receipt_path: applyReceiptPath,
    };
  } finally {
    db.close();
  }
}

module.exports = {
  DEFAULT_DEAD_CLIENT_MIN_AGE_MS,
  DEFAULT_INTERVAL_MS,
  STARTUP_PRUNE_VERSION,
  runOAuth21StartupPrune,
};
