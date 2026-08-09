"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const ACTIVE_STATUSES = new Set(["queued", "running"]);

function createStoreError(message, code = "process_job_store_error") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeStorageFile(storageFile) {
  const value = String(storageFile || ":memory:").trim();
  if (!value) throw createStoreError("Process job storage file cannot be empty.");
  return value === ":memory:" ? value : path.resolve(value);
}

function processExists(pid, processKill = process.kill) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    processKill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function createProcessJobStore(options = {}) {
  const storageFile = normalizeStorageFile(options.storageFile);
  const runtimeScope = String(options.runtimeScope || "default");
  const serverInstanceId = String(options.serverInstanceId || "unknown-instance");
  const serverPid = Number.isInteger(options.serverPid) ? options.serverPid : process.pid;
  const processKill = options.processKill || process.kill;
  if (storageFile !== ":memory:") fs.mkdirSync(path.dirname(storageFile), { recursive: true });

  const db = options.database || new DatabaseSync(storageFile, { timeout: 5000 });
  db.exec("PRAGMA foreign_keys=ON");
  db.exec("PRAGMA busy_timeout=5000");
  db.exec("PRAGMA synchronous=FULL");
  if (storageFile !== ":memory:") db.exec("PRAGMA journal_mode=WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS process_jobs (
      job_id TEXT PRIMARY KEY,
      runtime_scope TEXT NOT NULL,
      owner_key TEXT NOT NULL,
      command TEXT NOT NULL,
      family TEXT NOT NULL,
      resolution_class TEXT NOT NULL,
      cwd TEXT NOT NULL,
      workspace TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      started_at_ms INTEGER,
      finished_at_ms INTEGER,
      updated_at_ms INTEGER NOT NULL,
      timeout_ms INTEGER NOT NULL,
      output_limit_chars INTEGER NOT NULL,
      stdout TEXT NOT NULL DEFAULT '',
      stderr TEXT NOT NULL DEFAULT '',
      stdout_truncated INTEGER NOT NULL DEFAULT 0,
      stderr_truncated INTEGER NOT NULL DEFAULT 0,
      exit_code INTEGER,
      signal TEXT,
      timed_out INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      cancellation_reason_code TEXT,
      server_instance_id TEXT NOT NULL,
      server_pid INTEGER,
      recovered_after_restart INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_process_jobs_owner_created
      ON process_jobs(runtime_scope, owner_key, created_at_ms DESC);
    CREATE INDEX IF NOT EXISTS idx_process_jobs_status
      ON process_jobs(runtime_scope, status, updated_at_ms);
    CREATE TABLE IF NOT EXISTS process_job_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      event TEXT NOT NULL,
      reason_code TEXT,
      created_at_ms INTEGER NOT NULL,
      server_instance_id TEXT NOT NULL,
      FOREIGN KEY(job_id) REFERENCES process_jobs(job_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_process_job_events_job
      ON process_job_events(job_id, id);
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

  function insertEvent(jobId, fromStatus, toStatus, event, reasonCode, createdAtMs) {
    db.prepare(`
      INSERT INTO process_job_events
        (job_id, from_status, to_status, event, reason_code, created_at_ms, server_instance_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(jobId, fromStatus, toStatus, event, reasonCode || null, createdAtMs, serverInstanceId);
  }

  function rowToRecord(row) {
    if (!row) return null;
    return {
      id: row.job_id,
      ownerKey: row.owner_key,
      command: row.command,
      family: row.family,
      resolutionClass: row.resolution_class,
      cwd: row.cwd,
      workspace: row.workspace,
      status: row.status,
      createdAtMs: Number(row.created_at_ms),
      startedAtMs: row.started_at_ms === null ? null : Number(row.started_at_ms),
      finishedAtMs: row.finished_at_ms === null ? null : Number(row.finished_at_ms),
      updatedAtMs: Number(row.updated_at_ms),
      timeoutMs: Number(row.timeout_ms),
      outputLimit: Number(row.output_limit_chars),
      stdout: row.stdout,
      stderr: row.stderr,
      stdoutTruncated: row.stdout_truncated === 1,
      stderrTruncated: row.stderr_truncated === 1,
      exitCode: row.exit_code === null ? null : Number(row.exit_code),
      signal: row.signal,
      timedOut: row.timed_out === 1,
      error: row.error,
      cancellationReasonCode: row.cancellation_reason_code,
      serverInstanceId: row.server_instance_id,
      serverPid: row.server_pid === null ? null : Number(row.server_pid),
      recoveredAfterRestart: row.recovered_after_restart === 1,
    };
  }

  function selectAny(jobId) {
    return rowToRecord(db.prepare(
      "SELECT * FROM process_jobs WHERE runtime_scope=? AND job_id=?"
    ).get(runtimeScope, String(jobId || "")));
  }

  function create(job) {
    return transaction(() => {
      db.prepare(`
        INSERT INTO process_jobs (
          job_id, runtime_scope, owner_key, command, family, resolution_class, cwd, workspace,
          status, created_at_ms, updated_at_ms, timeout_ms, output_limit_chars,
          server_instance_id, server_pid
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?)
      `).run(
        job.id, runtimeScope, job.ownerKey, job.command, job.family, job.resolutionClass,
        job.cwd, job.workspace, job.createdAtMs, job.createdAtMs, job.timeoutMs,
        job.outputLimit, serverInstanceId, serverPid
      );
      insertEvent(job.id, null, "queued", "process_job_queued", null, job.createdAtMs);
      return selectAny(job.id);
    });
  }

  function markRunning(jobId, startedAtMs) {
    return transaction(() => {
      const current = selectAny(jobId);
      if (!current || current.status !== "queued") {
        throw createStoreError(`Cannot transition process job ${jobId} to running.`, "process_job_state_conflict");
      }
      db.prepare(`
        UPDATE process_jobs
        SET status='running', started_at_ms=?, updated_at_ms=?, server_instance_id=?, server_pid=?
        WHERE runtime_scope=? AND job_id=? AND status='queued'
      `).run(startedAtMs, startedAtMs, serverInstanceId, serverPid, runtimeScope, jobId);
      insertEvent(jobId, "queued", "running", "process_job_started", null, startedAtMs);
      return selectAny(jobId);
    });
  }

  function appendOutput(jobId, stream, text, truncated = false, updatedAtMs = Date.now()) {
    if (stream !== "stdout" && stream !== "stderr") {
      throw createStoreError(`Unknown process output stream: ${stream}`);
    }
    const chunk = String(text || "");
    if (!chunk && !truncated) return selectAny(jobId);
    return transaction(() => {
      const current = selectAny(jobId);
      if (!current) throw createStoreError(`Unknown process job: ${jobId}`, "process_job_not_found");
      if (!ACTIVE_STATUSES.has(current.status)) return current;
      const used = current.stdout.length + current.stderr.length;
      const accepted = chunk.slice(0, Math.max(0, current.outputLimit - used));
      const next = stream === "stdout"
        ? current.stdout + accepted
        : current.stderr + accepted;
      const wasTruncated = stream === "stdout" ? current.stdoutTruncated : current.stderrTruncated;
      const isTruncated = wasTruncated || truncated || accepted.length < chunk.length;
      db.prepare(`
        UPDATE process_jobs
        SET ${stream}=?, ${stream}_truncated=?, updated_at_ms=?
        WHERE runtime_scope=? AND job_id=?
      `).run(next, isTruncated ? 1 : 0, updatedAtMs, runtimeScope, jobId);
      return selectAny(jobId);
    });
  }

  function finish(jobId, result, finishedAtMs, reasonCode = null) {
    return transaction(() => {
      const current = selectAny(jobId);
      if (!current) throw createStoreError(`Unknown process job: ${jobId}`, "process_job_not_found");
      if (!ACTIVE_STATUSES.has(current.status)) return current;
      const stdout = String(result.stdout || "").slice(0, current.outputLimit);
      const stderr = String(result.stderr || "").slice(0, Math.max(0, current.outputLimit - stdout.length));
      db.prepare(`
        UPDATE process_jobs SET
          status=?, finished_at_ms=?, updated_at_ms=?, stdout=?, stderr=?,
          stdout_truncated=?, stderr_truncated=?, exit_code=?, signal=?, timed_out=?, error=?,
          cancellation_reason_code=?, server_instance_id=?, server_pid=?
        WHERE runtime_scope=? AND job_id=?
      `).run(
        result.status, finishedAtMs, finishedAtMs, stdout, stderr,
        result.stdout_truncated || stdout.length < String(result.stdout || "").length ? 1 : 0,
        result.stderr_truncated || stderr.length < String(result.stderr || "").length ? 1 : 0,
        Number.isInteger(result.exit_code) ? result.exit_code : null,
        result.signal || null,
        result.timed_out ? 1 : 0,
        result.error || null,
        reasonCode || null,
        serverInstanceId,
        serverPid,
        runtimeScope,
        jobId
      );
      insertEvent(jobId, current.status, result.status, "process_job_completed", reasonCode, finishedAtMs);
      return selectAny(jobId);
    });
  }

  function get(jobId, ownerKey) {
    return rowToRecord(db.prepare(`
      SELECT * FROM process_jobs
      WHERE runtime_scope=? AND job_id=? AND owner_key=?
    `).get(runtimeScope, String(jobId || ""), String(ownerKey || "")));
  }

  function list(ownerKey, options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit || 20), 100));
    const status = String(options.status || "").trim();
    const rows = status
      ? db.prepare(`
          SELECT * FROM process_jobs
          WHERE runtime_scope=? AND owner_key=? AND status=?
          ORDER BY created_at_ms DESC LIMIT ?
        `).all(runtimeScope, ownerKey, status, limit)
      : db.prepare(`
          SELECT * FROM process_jobs
          WHERE runtime_scope=? AND owner_key=?
          ORDER BY created_at_ms DESC LIMIT ?
        `).all(runtimeScope, ownerKey, limit);
    return rows.map(rowToRecord);
  }

  function events(jobId, ownerKey, options = {}) {
    if (!get(jobId, ownerKey)) return null;
    const limit = Math.max(1, Math.min(Number(options.limit || 50), 200));
    return db.prepare(`
      SELECT id, from_status, to_status, event, reason_code, created_at_ms, server_instance_id
      FROM process_job_events
      WHERE job_id=? ORDER BY id DESC LIMIT ?
    `).all(jobId, limit).reverse().map((row) => ({
      sequence: Number(row.id),
      from_status: row.from_status,
      to_status: row.to_status,
      event: row.event,
      reason_code: row.reason_code,
      created_at: new Date(Number(row.created_at_ms)).toISOString(),
      server_instance_id: row.server_instance_id,
    }));
  }

  function reconcileOrphans(nowMs = Date.now()) {
    const rows = db.prepare(`
      SELECT * FROM process_jobs
      WHERE runtime_scope=? AND status IN ('queued','running') AND server_instance_id<>?
    `).all(runtimeScope, serverInstanceId).map(rowToRecord);
    const reconciled = [];
    for (const row of rows) {
      if (processExists(row.serverPid, processKill)) continue;
      transaction(() => {
        const current = selectAny(row.id);
        if (!current || !ACTIVE_STATUSES.has(current.status)) return;
        db.prepare(`
          UPDATE process_jobs SET
            status='interrupted', finished_at_ms=?, updated_at_ms=?, recovered_after_restart=1,
            error='server_restarted_before_terminal_state', server_instance_id=?, server_pid=?
          WHERE runtime_scope=? AND job_id=?
        `).run(nowMs, nowMs, serverInstanceId, serverPid, runtimeScope, row.id);
        insertEvent(row.id, current.status, "interrupted", "process_job_recovered_interrupted", "unclean_restart", nowMs);
      });
      reconciled.push(selectAny(row.id));
    }
    return reconciled;
  }

  function prune(nowMs, retentionMs, maxRetained) {
    const terminalRows = db.prepare(`
      SELECT job_id, finished_at_ms FROM process_jobs
      WHERE runtime_scope=? AND status NOT IN ('queued','running')
      ORDER BY finished_at_ms DESC, created_at_ms DESC
    `).all(runtimeScope);
    const cutoff = nowMs - retentionMs;
    const deleteIds = terminalRows
      .filter((row, index) => Number(row.finished_at_ms || 0) < cutoff || index >= maxRetained)
      .map((row) => row.job_id);
    if (!deleteIds.length) return [];
    transaction(() => {
      const statement = db.prepare("DELETE FROM process_jobs WHERE runtime_scope=? AND job_id=?");
      for (const jobId of deleteIds) statement.run(runtimeScope, jobId);
    });
    return deleteIds;
  }

  function counts() {
    const rows = db.prepare(`
      SELECT status, COUNT(*) AS count FROM process_jobs
      WHERE runtime_scope=? GROUP BY status
    `).all(runtimeScope);
    return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
  }

  function close() {
    db.close();
  }

  return {
    appendOutput,
    close,
    counts,
    create,
    events,
    finish,
    get,
    list,
    markRunning,
    prune,
    reconcileOrphans,
    runtimeScope,
    serverInstanceId,
    storageFile,
  };
}

module.exports = {
  ACTIVE_STATUSES,
  createProcessJobStore,
  normalizeStorageFile,
  processExists,
};
