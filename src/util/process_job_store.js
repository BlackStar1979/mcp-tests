"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { createHash, randomUUID } = require("node:crypto");

const ACTIVE_STATUSES = new Set(["queued", "running"]);
const DEFAULT_INSTANCE_LEASE_TTL_MS = 15000;
const MIN_INSTANCE_LEASE_TTL_MS = 1000;
const DEFAULT_ARTIFACT_RETENTION_MS = 86400000;
const MAX_ARTIFACT_RETENTION_MS = 604800000;
const DEFAULT_ARTIFACT_MAX_RETAINED = 512;
const MAX_ARTIFACT_MAX_RETAINED = 4096;
const DEFAULT_ARTIFACT_READ_CHARS = 65536;

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

function normalizeInstanceLeaseTtlMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_INSTANCE_LEASE_TTL_MS;
  return Math.max(MIN_INSTANCE_LEASE_TTL_MS, Math.floor(parsed));
}

function normalizeBoundedInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(Math.floor(parsed), max));
}

function normalizeArtifactId(value) {
  const normalized = String(value || "").replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(normalized) || /^0+$/.test(normalized)) {
    throw createStoreError("Artifact identifier generator returned an invalid opaque identifier.", "process_artifact_id_invalid");
  }
  return normalized;
}

function createProcessJobStore(options = {}) {
  const storageFile = normalizeStorageFile(options.storageFile);
  const runtimeScope = String(options.runtimeScope || "default");
  const serverInstanceId = String(options.serverInstanceId || "unknown-instance");
  const serverPid = Number.isInteger(options.serverPid) ? options.serverPid : process.pid;
  const processKill = options.processKill || process.kill;
  const now = options.now || Date.now;
  const instanceLeaseTtlMs = normalizeInstanceLeaseTtlMs(options.instanceLeaseTtlMs);
  const instanceLeaseRetentionMs = Math.max(60000, instanceLeaseTtlMs * 4);
  const artifactRetentionMs = normalizeBoundedInt(
    options.artifactRetentionMs, DEFAULT_ARTIFACT_RETENTION_MS, 60000, MAX_ARTIFACT_RETENTION_MS
  );
  const artifactMaxRetained = normalizeBoundedInt(
    options.artifactMaxRetained, DEFAULT_ARTIFACT_MAX_RETAINED, 2, MAX_ARTIFACT_MAX_RETAINED
  );
  const artifactReadChars = normalizeBoundedInt(
    options.artifactReadChars, DEFAULT_ARTIFACT_READ_CHARS, 1024, 262144
  );
  const createArtifactId = options.createArtifactId || randomUUID;
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
      trace_id TEXT,
      span_id TEXT,
      parent_span_id TEXT,
      trace_flags TEXT,
      trace_source TEXT,
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
    CREATE TABLE IF NOT EXISTS process_job_idempotency (
      runtime_scope TEXT NOT NULL,
      owner_key TEXT NOT NULL,
      operation TEXT NOT NULL,
      idempotency_key_hash TEXT NOT NULL,
      canonical_input_hash TEXT NOT NULL,
      job_id TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      PRIMARY KEY(runtime_scope, owner_key, operation, idempotency_key_hash),
      FOREIGN KEY(job_id) REFERENCES process_jobs(job_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_process_job_idempotency_job
      ON process_job_idempotency(job_id);
    CREATE TABLE IF NOT EXISTS process_job_instances (
      runtime_scope TEXT NOT NULL,
      server_instance_id TEXT NOT NULL,
      server_pid INTEGER NOT NULL,
      lease_updated_at_ms INTEGER NOT NULL,
      PRIMARY KEY(runtime_scope, server_instance_id)
    );
    CREATE INDEX IF NOT EXISTS idx_process_job_instances_lease
      ON process_job_instances(runtime_scope, lease_updated_at_ms);
    CREATE TABLE IF NOT EXISTS process_artifacts (
      artifact_id TEXT PRIMARY KEY,
      runtime_scope TEXT NOT NULL,
      owner_key TEXT NOT NULL,
      job_id TEXT NOT NULL,
      stream TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      content TEXT NOT NULL,
      content_chars INTEGER NOT NULL,
      content_bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      expires_at_ms INTEGER NOT NULL,
      trace_id TEXT,
      span_id TEXT,
      parent_span_id TEXT,
      trace_flags TEXT,
      trace_source TEXT,
      UNIQUE(runtime_scope, job_id, stream)
    );
    CREATE INDEX IF NOT EXISTS idx_process_artifacts_owner_created
      ON process_artifacts(runtime_scope, owner_key, created_at_ms DESC);
    CREATE INDEX IF NOT EXISTS idx_process_artifacts_expiry
      ON process_artifacts(runtime_scope, expires_at_ms);
  `);

  const processJobColumns = new Set(
    db.prepare("PRAGMA table_info(process_jobs)").all().map((row) => String(row.name))
  );
  for (const [column, type] of [
    ["trace_id", "TEXT"],
    ["span_id", "TEXT"],
    ["parent_span_id", "TEXT"],
    ["trace_flags", "TEXT"],
    ["trace_source", "TEXT"],
  ]) {
    if (!processJobColumns.has(column)) db.exec(`ALTER TABLE process_jobs ADD COLUMN ${column} ${type}`);
  }

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
      traceId: row.trace_id,
      spanId: row.span_id,
      parentSpanId: row.parent_span_id,
      traceFlags: row.trace_flags,
      traceSource: row.trace_source,
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

  function rowToArtifact(row) {
    if (!row) return null;
    return {
      artifactId: row.artifact_id,
      jobId: row.job_id,
      stream: row.stream,
      mimeType: row.mime_type,
      chars: Number(row.content_chars),
      bytes: Number(row.content_bytes),
      sha256: row.sha256,
      createdAtMs: Number(row.created_at_ms),
      expiresAtMs: Number(row.expires_at_ms),
      traceId: row.trace_id,
      spanId: row.span_id,
      parentSpanId: row.parent_span_id,
      traceFlags: row.trace_flags,
      traceSource: row.trace_source,
    };
  }

  function selectArtifact(artifactId, ownerKey, nowMs = now()) {
    return db.prepare(`
      SELECT * FROM process_artifacts
      WHERE runtime_scope=? AND artifact_id=? AND owner_key=? AND expires_at_ms>?
    `).get(runtimeScope, String(artifactId || ""), String(ownerKey || ""), nowMs) || null;
  }

  function insertArtifact(record, stream, content, createdAtMs) {
    const existing = db.prepare(`
      SELECT * FROM process_artifacts
      WHERE runtime_scope=? AND job_id=? AND stream=?
    `).get(runtimeScope, record.id, stream);
    if (existing) return rowToArtifact(existing);
    const artifactId = normalizeArtifactId(createArtifactId());
    const text = String(content || "");
    const sha256 = createHash("sha256").update(text, "utf8").digest("hex");
    db.prepare(`
      INSERT INTO process_artifacts (
        artifact_id, runtime_scope, owner_key, job_id, stream, mime_type, content,
        content_chars, content_bytes, sha256, created_at_ms, expires_at_ms,
        trace_id, span_id, parent_span_id, trace_flags, trace_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      artifactId, runtimeScope, record.ownerKey, record.id, stream, "text/plain; charset=utf-8", text,
      text.length, Buffer.byteLength(text, "utf8"), sha256, createdAtMs, createdAtMs + artifactRetentionMs,
      record.traceId || null, record.spanId || null, record.parentSpanId || null, record.traceFlags || null,
      record.traceSource || null
    );
    return rowToArtifact(db.prepare("SELECT * FROM process_artifacts WHERE artifact_id=?").get(artifactId));
  }

  function materializeArtifacts(record, createdAtMs) {
    if (!record || ACTIVE_STATUSES.has(record.status)) return [];
    return [
      insertArtifact(record, "stdout", record.stdout, createdAtMs),
      insertArtifact(record, "stderr", record.stderr, createdAtMs),
    ];
  }

  function selectIdempotency(ownerKey, operation, keyHash) {
    return db.prepare(`
      SELECT canonical_input_hash, job_id
      FROM process_job_idempotency
      WHERE runtime_scope=? AND owner_key=? AND operation=? AND idempotency_key_hash=?
    `).get(runtimeScope, ownerKey, operation, keyHash) || null;
  }

  function validateIdempotencyMatch(mapping, inputHash) {
    if (!mapping) return null;
    if (mapping.canonical_input_hash !== inputHash) {
      throw createStoreError(
        "Idempotency key was already used with different process arguments.",
        "process_idempotency_conflict"
      );
    }
    const record = selectAny(mapping.job_id);
    if (!record) {
      throw createStoreError(
        "Idempotency registry refers to a missing process job.",
        "process_job_store_corrupt"
      );
    }
    return record;
  }

  function refreshInstanceLease(updatedAtMs = now()) {
    transaction(() => {
      db.prepare(`
        INSERT INTO process_job_instances
          (runtime_scope, server_instance_id, server_pid, lease_updated_at_ms)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(runtime_scope, server_instance_id) DO UPDATE SET
          server_pid=excluded.server_pid,
          lease_updated_at_ms=excluded.lease_updated_at_ms
      `).run(runtimeScope, serverInstanceId, serverPid, updatedAtMs);
      db.prepare(`
        DELETE FROM process_job_instances
        WHERE runtime_scope=? AND server_instance_id<>? AND lease_updated_at_ms<?
      `).run(runtimeScope, serverInstanceId, updatedAtMs - instanceLeaseRetentionMs);
    });
  }

  function releaseInstanceLease() {
    db.prepare(`
      DELETE FROM process_job_instances
      WHERE runtime_scope=? AND server_instance_id=? AND server_pid=?
    `).run(runtimeScope, serverInstanceId, serverPid);
  }

  function hasLiveInstanceLease(record, nowMs) {
    const lease = db.prepare(`
      SELECT server_pid, lease_updated_at_ms
      FROM process_job_instances
      WHERE runtime_scope=? AND server_instance_id=?
    `).get(runtimeScope, record.serverInstanceId);
    if (!lease || Number(lease.server_pid) !== record.serverPid) return false;
    const leaseAgeMs = nowMs - Number(lease.lease_updated_at_ms);
    if (leaseAgeMs < 0 || leaseAgeMs > instanceLeaseTtlMs) return false;
    return processExists(record.serverPid, processKill);
  }

  function insertJob(job) {
    db.prepare(`
        INSERT INTO process_jobs (
          job_id, runtime_scope, owner_key, command, family, resolution_class, cwd, workspace,
          trace_id, span_id, parent_span_id, trace_flags, trace_source,
          status, created_at_ms, updated_at_ms, timeout_ms, output_limit_chars,
          server_instance_id, server_pid
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?)
      `).run(
        job.id, runtimeScope, job.ownerKey, job.command, job.family, job.resolutionClass,
        job.cwd, job.workspace, job.traceId || null, job.spanId || null,
        job.parentSpanId || null, job.traceFlags || null, job.traceSource || null,
        job.createdAtMs, job.createdAtMs, job.timeoutMs, job.outputLimit, serverInstanceId, serverPid
      );
    insertEvent(job.id, null, "queued", "process_job_queued", null, job.createdAtMs);
  }

  function create(job) {
    return transaction(() => {
      insertJob(job);
      return selectAny(job.id);
    });
  }

  function lookupIdempotent({ ownerKey, operation, keyHash, inputHash }) {
    return validateIdempotencyMatch(
      selectIdempotency(ownerKey, operation, keyHash),
      inputHash
    );
  }

  function createIdempotent(job, { operation, keyHash, inputHash }) {
    return transaction(() => {
      const existing = validateIdempotencyMatch(
        selectIdempotency(job.ownerKey, operation, keyHash),
        inputHash
      );
      if (existing) return { created: false, record: existing };

      insertJob(job);
      db.prepare(`
        INSERT INTO process_job_idempotency (
          runtime_scope, owner_key, operation, idempotency_key_hash,
          canonical_input_hash, job_id, created_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        runtimeScope,
        job.ownerKey,
        operation,
        keyHash,
        inputHash,
        job.id,
        job.createdAtMs
      );
      return { created: true, record: selectAny(job.id) };
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
      const finished = selectAny(jobId);
      materializeArtifacts(finished, finishedAtMs);
      return finished;
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
      const recovered = transaction(() => {
        const current = selectAny(row.id);
        if (!current || !ACTIVE_STATUSES.has(current.status)) return null;
        if (hasLiveInstanceLease(current, nowMs)) return null;
        db.prepare(`
          UPDATE process_jobs SET
            status='interrupted', finished_at_ms=?, updated_at_ms=?, recovered_after_restart=1,
            error='server_restarted_before_terminal_state', server_instance_id=?, server_pid=?
          WHERE runtime_scope=? AND job_id=?
        `).run(nowMs, nowMs, serverInstanceId, serverPid, runtimeScope, row.id);
        insertEvent(row.id, current.status, "interrupted", "process_job_recovered_interrupted", "unclean_restart", nowMs);
        const interrupted = selectAny(row.id);
        materializeArtifacts(interrupted, nowMs);
        return interrupted;
      });
      if (recovered) reconciled.push(recovered);
    }
    return reconciled;
  }

  function pruneArtifacts(nowMs = now()) {
    const removed = [];
    transaction(() => {
      const expired = db.prepare(`
        SELECT artifact_id FROM process_artifacts
        WHERE runtime_scope=? AND expires_at_ms<=?
      `).all(runtimeScope, nowMs);
      const deleteStatement = db.prepare("DELETE FROM process_artifacts WHERE runtime_scope=? AND artifact_id=?");
      for (const row of expired) {
        deleteStatement.run(runtimeScope, row.artifact_id);
        removed.push(row.artifact_id);
      }
      const overflow = db.prepare(`
        SELECT artifact_id FROM process_artifacts
        WHERE runtime_scope=?
        ORDER BY created_at_ms DESC, artifact_id DESC
        LIMIT -1 OFFSET ?
      `).all(runtimeScope, artifactMaxRetained);
      for (const row of overflow) {
        deleteStatement.run(runtimeScope, row.artifact_id);
        removed.push(row.artifact_id);
      }
    });
    return removed;
  }

  function artifacts(jobId, ownerKey) {
    pruneArtifacts(now());
    return transaction(() => {
      const record = get(jobId, ownerKey);
      if (!record) return null;
      if (ACTIVE_STATUSES.has(record.status)) return [];
      materializeArtifacts(record, record.finishedAtMs || record.updatedAtMs || now());
      return db.prepare(`
        SELECT * FROM process_artifacts
        WHERE runtime_scope=? AND job_id=? AND owner_key=?
        ORDER BY CASE stream WHEN 'stdout' THEN 0 ELSE 1 END, artifact_id
      `).all(runtimeScope, record.id, ownerKey).map(rowToArtifact);
    });
  }

  function readArtifact(artifactId, ownerKey, cursor = {}) {
    pruneArtifacts(now());
    const row = selectArtifact(artifactId, ownerKey, now());
    if (!row) return null;
    const text = String(row.content || "");
    const offset = Math.max(0, Math.min(Number(cursor.offset || 0), text.length));
    const maxChars = Math.max(1, Math.min(Number(cursor.maxChars || artifactReadChars), artifactReadChars));
    const chunk = text.slice(offset, offset + maxChars);
    const nextOffset = offset + chunk.length;
    return {
      ...rowToArtifact(row),
      text: chunk,
      offset,
      nextOffset,
      eof: nextOffset >= text.length,
    };
  }

  function prune(nowMs, retentionMs, maxRetained) {
    pruneArtifacts(nowMs);
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
    artifacts,
    close,
    counts,
    create,
    createIdempotent,
    events,
    finish,
    get,
    list,
    lookupIdempotent,
    markRunning,
    prune,
    pruneArtifacts,
    readArtifact,
    reconcileOrphans,
    refreshInstanceLease,
    releaseInstanceLease,
    runtimeScope,
    serverInstanceId,
    storageFile,
  };
}

module.exports = {
  ACTIVE_STATUSES,
  DEFAULT_ARTIFACT_MAX_RETAINED,
  DEFAULT_ARTIFACT_READ_CHARS,
  DEFAULT_ARTIFACT_RETENTION_MS,
  DEFAULT_INSTANCE_LEASE_TTL_MS,
  createProcessJobStore,
  normalizeInstanceLeaseTtlMs,
  normalizeStorageFile,
  processExists,
};
