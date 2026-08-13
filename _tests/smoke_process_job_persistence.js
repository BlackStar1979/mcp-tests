"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  createProcessJobManager,
  normalizeInstanceLeaseHeartbeatMs,
} = require("../src/util/process_job_manager");
const {
  createProcessJobStore,
  normalizeInstanceLeaseTtlMs,
} = require("../src/util/process_job_store");
const { PROCESS_RUNNER_CONFIG } = require("../src/util/process_runner_config");

async function waitFor(predicate, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

(async () => {
  assert.equal(normalizeInstanceLeaseTtlMs("invalid"), 15000);
  assert.equal(normalizeInstanceLeaseTtlMs(-1), 15000);
  assert.equal(normalizeInstanceLeaseTtlMs(1), 1000);
  assert.equal(normalizeInstanceLeaseHeartbeatMs("invalid", 15000), 5000);
  assert.equal(normalizeInstanceLeaseHeartbeatMs(99999, 15000), 7500);
  assert.equal(normalizeInstanceLeaseHeartbeatMs(1, 1000), 250);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-process-jobs-"));
  const storageFile = path.join(tempRoot, "jobs.sqlite");
  const runtimeScope = "smoke-process-jobs";
  const config = Object.freeze({
    ...PROCESS_RUNNER_CONFIG,
    maxConcurrent: 1,
    maxQueued: 2,
    maxRetained: 16,
    retentionMs: 60000,
  });
  const resources = [];

  try {
    const firstManager = createProcessJobManager({
      config,
      storageFile,
      runtimeScope,
      serverInstanceId: "instance-one",
      idempotencySecret: "persistent-idempotency-test-secret",
    });
    resources.push(firstManager);
    const first = firstManager.start({
      command: "node",
      args: ["-e", "process.stdout.write('durable-output')"],
      cwd: "mcp-tests",
    }, { ownerId: "client-a" });
    const firstDone = await waitFor(() => {
      const status = firstManager.status(first.job_id, { ownerId: "client-a" });
      return status.terminal ? status : null;
    });
    assert.equal(firstDone.status, "ok");
    assert.equal(firstDone.durable, true);
    const durableIdempotencyKey = "durable-retry-key-must-not-persist";
    const durableIdempotentInput = {
      command: "node",
      args: ["-e", "process.stdout.write('durable-idempotent-output')"],
      cwd: "mcp-tests",
      idempotency_key: durableIdempotencyKey,
    };
    const durableIdempotent = firstManager.start(
      durableIdempotentInput,
      { ownerId: "client-a" }
    );
    await waitFor(() => {
      const status = firstManager.status(durableIdempotent.job_id, { ownerId: "client-a" });
      return status.terminal ? status : null;
    });
    firstManager.close();

    const secondManager = createProcessJobManager({
      config,
      storageFile,
      runtimeScope,
      serverInstanceId: "instance-two",
      idempotencySecret: "persistent-idempotency-test-secret",
    });
    resources.push(secondManager);
    const recovered = secondManager.status(first.job_id, { ownerId: "client-a" });
    assert.equal(recovered.status, "ok");
    assert.equal(recovered.durable, true);
    assert.equal(recovered.recovered_after_restart, true);
    assert.equal(
      secondManager.output(first.job_id, { max_chars: 65536 }, { ownerId: "client-a" }).stdout,
      "durable-output"
    );
    assert.throws(
      () => secondManager.status(first.job_id, { ownerId: "client-b" }),
      /Unknown process job/
    );
    const listed = secondManager.list({ limit: 10 }, { ownerId: "client-a" });
    assert.equal(listed.jobs.some((job) => job.job_id === first.job_id), true);
    const completedEvents = secondManager.events(first.job_id, { limit: 50 }, { ownerId: "client-a" });
    assert.equal(completedEvents.events.some((event) => event.to_status === "ok"), true);
    const retriedAfterRestart = secondManager.start({
      ...durableIdempotentInput,
      trace_id: "post-restart-trace",
    }, { ownerId: "client-a" });
    assert.equal(retriedAfterRestart.job_id, durableIdempotent.job_id);
    assert.equal(retriedAfterRestart.status, "ok");
    assert.throws(
      () => secondManager.start({
        ...durableIdempotentInput,
        args: ["-e", "process.stdout.write('conflicting-retry')"],
      }, { ownerId: "client-a" }),
      (error) => error && error.code === "process_idempotency_conflict"
    );
    const otherOwnerRetry = secondManager.start(durableIdempotentInput, { ownerId: "client-b" });
    assert.notEqual(otherOwnerRetry.job_id, durableIdempotent.job_id);
    await waitFor(() => {
      const status = secondManager.status(otherOwnerRetry.job_id, { ownerId: "client-b" });
      return status.terminal ? status : null;
    });
    secondManager.close();

    const orphanStore = createProcessJobStore({
      storageFile,
      runtimeScope,
      serverInstanceId: "crashed-instance",
      serverPid: 999999,
      processKill: () => { throw new Error("not running"); },
    });
    resources.push(orphanStore);
    orphanStore.create({
      id: "orphan-job",
      ownerKey: "owner-key",
      command: "node",
      family: "runtime",
      resolutionClass: "pinned_node_runtime",
      cwd: "mcp-tests",
      workspace: "work",
      createdAtMs: 1000,
      timeoutMs: 30000,
      outputLimit: 10000,
    });
    orphanStore.markRunning("orphan-job", 1100);
    orphanStore.appendOutput("orphan-job", "stdout", "partial-before-crash", false, 1200);
    orphanStore.close();

    const recoveryAudit = [];
    const recoveredManager = createProcessJobManager({
      config,
      storageFile,
      runtimeScope,
      serverInstanceId: "instance-three",
      now: () => 2000,
      audit: (event) => recoveryAudit.push(event),
    });
    resources.push(recoveredManager);
    const interrupted = recoveredManager.status("orphan-job", {
      ownerId: "owner-key",
      ownerKeyIsPrehashed: true,
    });
    assert.equal(interrupted.status, "interrupted");
    assert.equal(interrupted.terminal, true);
    assert.equal(interrupted.recovered_after_restart, true);
    const interruptedOutput = recoveredManager.output(
      "orphan-job",
      { max_chars: 65536 },
      { ownerId: "owner-key", ownerKeyIsPrehashed: true }
    );
    assert.equal(interruptedOutput.stdout, "partial-before-crash");
    const interruptedEvents = recoveredManager.events(
      "orphan-job",
      { limit: 50 },
      { ownerId: "owner-key", ownerKeyIsPrehashed: true }
    );
    assert.deepEqual(
      interruptedEvents.events.map((event) => event.to_status),
      ["queued", "running", "interrupted"]
    );
    assert.ok(recoveryAudit.some((event) => (
      event.event === "process_job_recovered_interrupted"
      && event.job_id === "orphan-job"
      && event.reason_code === "unclean_restart"
    )));
    recoveredManager.close();

    let leaseNow = 5000;
    let leaseMaintenanceTick = null;
    const reusedPid = 4242;
    const reusedPidStore = createProcessJobStore({
      storageFile,
      runtimeScope,
      serverInstanceId: "pid-reuse-old-instance",
      serverPid: reusedPid,
      processKill: () => true,
      now: () => leaseNow,
      instanceLeaseTtlMs: 1000,
    });
    resources.push(reusedPidStore);
    reusedPidStore.refreshInstanceLease();
    reusedPidStore.create({
      id: "pid-reuse-job",
      ownerKey: "pid-reuse-owner",
      command: "node",
      family: "runtime",
      resolutionClass: "pinned_node_runtime",
      cwd: "mcp-tests",
      workspace: "work",
      createdAtMs: leaseNow,
      timeoutMs: 30000,
      outputLimit: 10000,
    });
    reusedPidStore.markRunning("pid-reuse-job", leaseNow + 10);
    reusedPidStore.close();

    leaseNow += 500;
    const reusedPidRecoveryAudit = [];
    const reusedPidManager = createProcessJobManager({
      config,
      storageFile,
      runtimeScope,
      serverInstanceId: "pid-reuse-new-instance",
      serverPid: 4343,
      processKill: () => true,
      now: () => leaseNow,
      instanceLeaseTtlMs: 1000,
      instanceLeaseHeartbeatMs: 250,
      setInterval: (callback) => {
        leaseMaintenanceTick = callback;
        return { unref() {} };
      },
      clearInterval: () => {},
      audit: (event) => reusedPidRecoveryAudit.push(event),
    });
    resources.push(reusedPidManager);
    const freshLeaseStatus = reusedPidManager.status("pid-reuse-job", {
      ownerId: "pid-reuse-owner",
      ownerKeyIsPrehashed: true,
    });
    assert.equal(freshLeaseStatus.status, "running");
    assert.equal(freshLeaseStatus.recovered_after_restart, true);

    leaseNow += 501;
    leaseMaintenanceTick();
    const reusedPidInterrupted = reusedPidManager.status("pid-reuse-job", {
      ownerId: "pid-reuse-owner",
      ownerKeyIsPrehashed: true,
    });
    assert.equal(reusedPidInterrupted.status, "interrupted");
    assert.equal(reusedPidInterrupted.terminal, true);
    assert.ok(reusedPidRecoveryAudit.some((event) => (
      event.event === "process_job_recovered_interrupted"
      && event.job_id === "pid-reuse-job"
      && event.reason_code === "unclean_restart"
    )));
    reusedPidManager.close();

    const secretArg = "must-not-persist-process-argument";
    const redactionManager = createProcessJobManager({
      config,
      storageFile,
      runtimeScope,
      serverInstanceId: "instance-four",
    });
    resources.push(redactionManager);
    const redacted = redactionManager.start({
      command: "node",
      args: ["-e", `const privateValue = '${secretArg}'; void privateValue;`],
      cwd: "mcp-tests",
      env: { NODE_ENV: "must-not-persist-process-env" },
    }, { ownerId: "client-a" });
    await waitFor(() => redactionManager.status(redacted.job_id, { ownerId: "client-a" }).terminal);
    redactionManager.close();
    const databaseBytes = fs.readFileSync(storageFile).toString("latin1");
    assert.equal(databaseBytes.includes(secretArg), false);
    assert.equal(databaseBytes.includes("must-not-persist-process-env"), false);
    assert.equal(databaseBytes.includes(durableIdempotencyKey), false);

    console.log("smoke_process_job_persistence ok");
  } finally {
    for (const resource of resources.reverse()) {
      try { resource.close(); } catch {}
    }
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
