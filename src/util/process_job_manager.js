"use strict";

const { createHash, randomUUID } = require("node:crypto");

const {
  prepareProcessExecution,
  startProcessExecution,
} = require("./process_execution");
const { PROCESS_RUNNER_CONFIG } = require("./process_runner_config");
const { createProcessJobStore } = require("./process_job_store");

const TERMINAL_STATUSES = new Set([
  "ok",
  "nonzero_exit",
  "timeout",
  "spawn_error",
  "cancelled",
  "interrupted",
]);

function unknownJob(jobId) {
  const error = new Error(`Unknown process job: ${jobId}`);
  error.code = "process_job_not_found";
  return error;
}

function ownerKey(ownerId, prehashed = false) {
  if (prehashed) return String(ownerId || "");
  return createHash("sha256")
    .update(String(ownerId || "unknown_client"), "utf8")
    .digest("hex");
}

function resolveProcessJobOwner(context = {}) {
  return String(
    context.authResult?.clientId
      || context.authResult?.client_id
      || "unknown_client"
  );
}

function cancellationReasonCode(reason) {
  return reason === "server_restart" ? "server_restart" : "requested";
}

function createProcessJobManager(options = {}) {
  const config = options.config || PROCESS_RUNNER_CONFIG;
  const prepareExecution = options.prepareExecution || prepareProcessExecution;
  const startExecution = options.startExecution || startProcessExecution;
  const now = options.now || Date.now;
  const createId = options.randomUUID || randomUUID;
  const executionDependencies = options.executionDependencies || {};
  const runtimeScope = String(options.runtimeScope || "default");
  const serverInstanceId = String(options.serverInstanceId || `process-${process.pid}`);
  const store = options.store || createProcessJobStore({
    storageFile: options.storageFile || ":memory:",
    runtimeScope,
    serverInstanceId,
    serverPid: options.serverPid,
    processKill: options.processKill,
  });
  const jobs = new Map();
  const queue = [];
  let audit = typeof options.audit === "function" ? options.audit : () => {};
  let shuttingDown = false;

  function emit(event, job, details = {}) {
    const payload = {
      event,
      job_id: job.id,
      command: job.prepared.invocation.logicalCommand,
      status: job.status,
      ...details,
    };
    try {
      audit(payload);
    } catch {
      // Audit transport failure must not orphan or change process lifecycle state.
    }
  }

  function setAudit(nextAudit) {
    audit = typeof nextAudit === "function" ? nextAudit : () => {};
  }

  function hydrate(record) {
    if (!record) return null;
    return {
      id: record.id,
      ownerKey: record.ownerKey,
      prepared: {
        timeoutMs: record.timeoutMs,
        outputLimit: record.outputLimit,
        invocation: {
          logicalCommand: record.command,
          family: record.family,
          resolutionClass: record.resolutionClass,
          cwdInfo: {
            displayPath: record.cwd,
            rootAlias: record.workspace,
          },
        },
      },
      status: record.status,
      createdAtMs: record.createdAtMs,
      startedAtMs: record.startedAtMs,
      finishedAtMs: record.finishedAtMs,
      cancelReason: null,
      handle: null,
      result: {
        status: record.status,
        exit_code: record.exitCode,
        signal: record.signal,
        timed_out: record.timedOut,
        stdout: record.stdout,
        stderr: record.stderr,
        stdout_truncated: record.stdoutTruncated,
        stderr_truncated: record.stderrTruncated,
        error: record.error,
      },
      recoveredAfterRestart: record.recoveredAfterRestart || record.serverInstanceId !== serverInstanceId,
      persistedOnly: true,
    };
  }

  for (const record of store.reconcileOrphans(now())) {
    const recovered = hydrate(record);
    if (recovered) {
      emit("process_job_recovered_interrupted", recovered, {
        reason_code: "unclean_restart",
      });
    }
  }

  function terminalJobs() {
    return [...jobs.values()].filter((job) => TERMINAL_STATUSES.has(job.status));
  }

  function prune() {
    const currentTime = now();
    const removedIds = store.prune(currentTime, config.retentionMs, config.maxRetained);
    for (const jobId of removedIds) {
      const removed = jobs.get(jobId);
      jobs.delete(jobId);
      if (removed) emit("process_job_pruned", removed, { reason: "retention_policy" });
    }
  }

  function runningCount() {
    return [...jobs.values()].filter((job) => job.status === "running").length;
  }

  function finishJob(job, result) {
    if (TERMINAL_STATUSES.has(job.status)) return;
    job.status = result.status;
    job.result = result;
    job.finishedAtMs = now();
    const reasonCode = result.status === "cancelled"
      ? cancellationReasonCode(job.cancelReason)
      : result.status === "interrupted"
        ? "unclean_restart"
        : null;
    try {
      store.finish(job.id, result, job.finishedAtMs, reasonCode);
    } catch (error) {
      emit("process_job_persistence_failed", job, {
        phase: "finish",
        error_message: error?.message || String(error),
      });
    }
    emit("process_job_completed", job, {
      duration_ms: Math.max(0, job.finishedAtMs - job.startedAtMs),
      exit_code: result.exit_code,
      signal: result.signal,
      timed_out: result.timed_out,
      stdout_chars: result.stdout.length,
      stderr_chars: result.stderr.length,
      stdout_truncated: result.stdout_truncated,
      stderr_truncated: result.stderr_truncated,
    });
    if (result.status === "timeout") emit("process_job_timed_out", job);
    if (result.status === "spawn_error") emit("process_job_spawn_failed", job);
    if (result.status === "cancelled") {
      emit("process_job_cancelled", job, {
        reason_code: cancellationReasonCode(job.cancelReason),
      });
    }
    prune();
    pump();
  }

  function launch(job) {
    if (shuttingDown || TERMINAL_STATUSES.has(job.status)) return;
    job.status = "running";
    job.startedAtMs = now();
    try {
      store.markRunning(job.id, job.startedAtMs);
      job.handle = startExecution(job.input, {
        ...executionDependencies,
        config,
        prepared: job.prepared,
        onOutput: ({ stream, text, truncated }) => {
          store.appendOutput(job.id, stream, text, truncated, now());
        },
        onPersistenceError: (error) => {
          emit("process_job_persistence_failed", job, {
            phase: "output",
            error_message: error?.message || String(error),
          });
        },
      });
      emit("process_job_started", job, {
        queue_wait_ms: Math.max(0, job.startedAtMs - job.createdAtMs),
        timeout_ms: job.prepared.timeoutMs,
        output_limit_chars: job.prepared.outputLimit,
        resolution_class: job.prepared.invocation.resolutionClass,
      });
      job.handle.completion.then(
        (result) => finishJob(job, result),
        (error) => finishJob(job, {
          status: "spawn_error",
          exit_code: null,
          signal: null,
          timed_out: false,
          stdout: "",
          stderr: "",
          stdout_truncated: false,
          stderr_truncated: false,
          error: error?.message || String(error),
        })
      );
    } catch (error) {
      finishJob(job, {
        status: "spawn_error",
        exit_code: null,
        signal: null,
        timed_out: false,
        stdout: "",
        stderr: "",
        stdout_truncated: false,
        stderr_truncated: false,
        error: error?.message || String(error),
      });
    }
  }

  function pump() {
    if (shuttingDown) return;
    while (queue.length > 0 && runningCount() < config.maxConcurrent) {
      const jobId = queue.shift();
      const job = jobs.get(jobId);
      if (!job || job.status !== "queued") continue;
      launch(job);
    }
  }

  function toStatus(job) {
    const handleSnapshot = job.handle?.snapshot?.() || null;
    const result = job.result;
    const terminal = TERMINAL_STATUSES.has(job.status);
    const finishedOrNow = job.finishedAtMs || now();
    return {
      job_id: job.id,
      status: job.status,
      terminal,
      command: job.prepared.invocation.logicalCommand,
      family: job.prepared.invocation.family,
      resolution_class: job.prepared.invocation.resolutionClass,
      cwd: job.prepared.invocation.cwdInfo.displayPath,
      workspace: job.prepared.invocation.cwdInfo.rootAlias,
      queue_position: job.status === "queued" ? queue.indexOf(job.id) + 1 : null,
      created_at: new Date(job.createdAtMs).toISOString(),
      started_at: job.startedAtMs === null ? null : new Date(job.startedAtMs).toISOString(),
      finished_at: job.finishedAtMs === null ? null : new Date(job.finishedAtMs).toISOString(),
      duration_ms: job.startedAtMs === null ? 0 : Math.max(0, finishedOrNow - job.startedAtMs),
      timeout_ms: job.prepared.timeoutMs,
      output_limit_chars: job.prepared.outputLimit,
      stdout_chars: result?.stdout.length ?? handleSnapshot?.stdout_chars ?? 0,
      stderr_chars: result?.stderr.length ?? handleSnapshot?.stderr_chars ?? 0,
      stdout_truncated: result?.stdout_truncated ?? handleSnapshot?.stdout_truncated ?? false,
      stderr_truncated: result?.stderr_truncated ?? handleSnapshot?.stderr_truncated ?? false,
      exit_code: result?.exit_code ?? null,
      signal: result?.signal ?? null,
      timed_out: result?.timed_out ?? false,
      error: result?.error ?? null,
      durable: true,
      recovered_after_restart: job.recoveredAfterRestart === true,
    };
  }

  function start(input = {}, owner = {}) {
    if (shuttingDown) throw new Error("Process job manager is shutting down.");
    prune();
    if (runningCount() >= config.maxConcurrent && queue.length >= config.maxQueued) {
      const error = new Error("Process job queue is full.");
      error.code = "process_job_queue_full";
      throw error;
    }

    const prepared = prepareExecution(input, { ...executionDependencies, config });
    const createdAtMs = now();
    const job = {
      id: createId(),
      ownerKey: ownerKey(owner.ownerId, owner.ownerKeyIsPrehashed === true),
      input: { ...input },
      prepared,
      status: "queued",
      createdAtMs,
      startedAtMs: null,
      finishedAtMs: null,
      cancelReason: null,
      handle: null,
      result: null,
      recoveredAfterRestart: false,
      persistedOnly: false,
    };
    store.create({
      id: job.id,
      ownerKey: job.ownerKey,
      command: prepared.invocation.logicalCommand,
      family: prepared.invocation.family,
      resolutionClass: prepared.invocation.resolutionClass,
      cwd: prepared.invocation.cwdInfo.displayPath,
      workspace: prepared.invocation.cwdInfo.rootAlias,
      createdAtMs,
      timeoutMs: prepared.timeoutMs,
      outputLimit: prepared.outputLimit,
    });
    jobs.set(job.id, job);
    queue.push(job.id);
    emit("process_job_queued", job, {
      timeout_ms: prepared.timeoutMs,
      output_limit_chars: prepared.outputLimit,
      family: prepared.invocation.family,
    });
    pump();
    return toStatus(job);
  }

  function getJob(jobId, owner = {}) {
    prune();
    const expectedOwnerKey = ownerKey(owner.ownerId, owner.ownerKeyIsPrehashed === true);
    let job = jobs.get(String(jobId || ""));
    if (job && job.ownerKey !== expectedOwnerKey) throw unknownJob(jobId);
    if (!job) job = hydrate(store.get(jobId, expectedOwnerKey));
    if (!job) throw unknownJob(jobId);
    return job;
  }

  function status(jobId, owner = {}) {
    return toStatus(getJob(jobId, owner));
  }

  function output(jobId, cursor = {}, owner = {}) {
    const job = getJob(jobId, owner);
    const payload = job.handle
      ? job.handle.readOutput(cursor)
      : readPersistedOutput(job, cursor);
    emit("process_job_output_read", job, {
      stdout_offset: payload.stdout_offset,
      stderr_offset: payload.stderr_offset,
      returned_chars: payload.stdout.length + payload.stderr.length,
    });
    return { job_id: job.id, ...payload };
  }

  function readPersistedOutput(job, cursor = {}) {
    const stdout = String(job.result?.stdout || "");
    const stderr = String(job.result?.stderr || "");
    const stdoutOffset = Math.max(0, Math.min(Number(cursor.stdout_offset || 0), job.prepared.outputLimit));
    const stderrOffset = Math.max(0, Math.min(Number(cursor.stderr_offset || 0), job.prepared.outputLimit));
    let remaining = Math.max(1, Math.min(Number(cursor.max_chars || config.outputReadChars), config.outputReadChars));
    const stdoutChunk = stdout.slice(stdoutOffset, stdoutOffset + remaining);
    remaining -= stdoutChunk.length;
    const stderrChunk = stderr.slice(stderrOffset, stderrOffset + remaining);
    const stdoutNextOffset = stdoutOffset + stdoutChunk.length;
    const stderrNextOffset = stderrOffset + stderrChunk.length;
    return {
      stdout: stdoutChunk,
      stderr: stderrChunk,
      stdout_offset: stdoutOffset,
      stderr_offset: stderrOffset,
      stdout_next_offset: stdoutNextOffset,
      stderr_next_offset: stderrNextOffset,
      stdout_eof: TERMINAL_STATUSES.has(job.status) && stdoutNextOffset >= stdout.length,
      stderr_eof: TERMINAL_STATUSES.has(job.status) && stderrNextOffset >= stderr.length,
      terminal: TERMINAL_STATUSES.has(job.status),
      status: job.status,
    };
  }

  function list(options = {}, owner = {}) {
    prune();
    const expectedOwnerKey = ownerKey(owner.ownerId, owner.ownerKeyIsPrehashed === true);
    return {
      durable: true,
      jobs: store.list(expectedOwnerKey, options).map((record) => (
        toStatus(jobs.get(record.id) || hydrate(record))
      )),
    };
  }

  function events(jobId, options = {}, owner = {}) {
    const expectedOwnerKey = ownerKey(owner.ownerId, owner.ownerKeyIsPrehashed === true);
    const rows = store.events(jobId, expectedOwnerKey, options);
    if (!rows) throw unknownJob(jobId);
    return { job_id: String(jobId), durable: true, events: rows };
  }

  async function cancel(jobId, reason = "cancelled", owner = {}) {
    const job = getJob(jobId, owner);
    if (TERMINAL_STATUSES.has(job.status)) return toStatus(job);
    job.cancelReason = String(reason || "cancelled").slice(0, 200);
    if (job.status === "queued") {
      const index = queue.indexOf(job.id);
      if (index >= 0) queue.splice(index, 1);
      job.status = "cancelled";
      job.finishedAtMs = now();
      job.result = {
        status: "cancelled",
        exit_code: null,
        signal: null,
        timed_out: false,
        stdout: "",
        stderr: "",
        stdout_truncated: false,
        stderr_truncated: false,
        error: null,
      };
      store.finish(
        job.id,
        job.result,
        job.finishedAtMs,
        cancellationReasonCode(job.cancelReason)
      );
      emit("process_job_cancelled", job, {
        reason_code: cancellationReasonCode(job.cancelReason),
      });
      prune();
      pump();
      return toStatus(job);
    }

    const result = await job.handle.cancel(job.cancelReason);
    finishJob(job, result);
    return toStatus(job);
  }

  function snapshot() {
    prune();
    return {
      shutting_down: shuttingDown,
      running_jobs: runningCount(),
      queued_jobs: queue.length,
      terminal_jobs: terminalJobs().length,
      max_concurrent: config.maxConcurrent,
      max_queued: config.maxQueued,
      max_retained: config.maxRetained,
      retention_ms: config.retentionMs,
      durable: true,
      persistence: "sqlite",
      persisted_status_counts: store.counts(),
    };
  }

  async function shutdown(reason = "server_restart") {
    if (shuttingDown) return snapshot();
    shuttingDown = true;
    const pending = [...jobs.values()]
      .filter((job) => !TERMINAL_STATUSES.has(job.status))
      .map((job) => cancel(job.id, reason, { ownerId: job.ownerKey, ownerKeyIsPrehashed: true }));
    await Promise.allSettled(pending);
    return snapshot();
  }

  function close() {
    store.close();
  }

  return {
    cancel,
    close,
    events,
    list,
    output,
    setAudit,
    shutdown,
    snapshot,
    start,
    status,
  };
}

let defaultManager = null;

function getDefaultProcessJobManager(options = {}) {
  if (!defaultManager) defaultManager = createProcessJobManager(options);
  else if (options.audit) defaultManager.setAudit(options.audit);
  return defaultManager;
}

async function shutdownDefaultProcessJobManager(reason = "server_restart") {
  if (!defaultManager) return null;
  return defaultManager.shutdown(reason);
}

function resolveProcessJobManager(context = {}) {
  if (context.processJobManager) return context.processJobManager;
  const audit = typeof context.auditLog === "function"
    ? (payload) => {
        const { event, ...details } = payload;
        context.auditLog(event, details);
      }
    : undefined;
  return getDefaultProcessJobManager({ audit });
}

module.exports = {
  TERMINAL_STATUSES,
  createProcessJobManager,
  getDefaultProcessJobManager,
  resolveProcessJobOwner,
  resolveProcessJobManager,
  shutdownDefaultProcessJobManager,
};
