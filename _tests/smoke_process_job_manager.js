"use strict";

const assert = require("node:assert/strict");

const { createProcessJobManager } = require("../src/util/process_job_manager");
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
  const audits = [];
  const config = Object.freeze({
    ...PROCESS_RUNNER_CONFIG,
    maxConcurrent: 1,
    maxQueued: 2,
    maxRetained: 3,
    retentionMs: 60000,
  });
  const manager = createProcessJobManager({
    config,
    audit: (event) => audits.push(event),
  });

  const first = manager.start({
    command: "node",
    args: ["-e", "setTimeout(() => process.stdout.write('first-secret'), 5000)"],
    cwd: "mcp-tests",
    env: { NODE_ENV: "audit-secret-value" },
    timeout_ms: 10000,
  });
  const second = manager.start({
    command: "node",
    args: ["-e", "process.stdout.write('second-output')"],
    cwd: "mcp-tests",
  });

  assert.equal(first.status, "running");
  assert.equal(second.status, "queued");
  assert.equal(second.queue_position, 1);
  assert.equal(manager.status(first.job_id).terminal, false);

  const cancelled = await manager.cancel(first.job_id, "cancel-secret-value");
  assert.equal(cancelled.status, "cancelled");
  const secondDone = await waitFor(() => {
    const status = manager.status(second.job_id);
    return status.terminal ? status : null;
  });
  assert.equal(secondDone.status, "ok");
  assert.equal(secondDone.stdout_chars, "second-output".length);

  const output = manager.output(second.job_id, {
    stdout_offset: 0,
    stderr_offset: 0,
    max_chars: 6,
  });
  assert.equal(output.stdout, "second");
  assert.equal(output.stdout_next_offset, 6);
  const outputRest = manager.output(second.job_id, {
    stdout_offset: output.stdout_next_offset,
    stderr_offset: output.stderr_next_offset,
    max_chars: 65536,
  });
  assert.equal(outputRest.stdout, "-output");
  assert.equal(outputRest.stdout_eof, true);

  const running = manager.start({
    command: "node",
    args: ["-e", "setTimeout(() => {}, 5000)"],
    cwd: "mcp-tests",
  });
  const queued = manager.start({
    command: "node",
    args: ["-e", "process.stdout.write('must-not-run')"],
    cwd: "mcp-tests",
  });
  assert.equal(queued.status, "queued");
  const queuedCancelled = await manager.cancel(queued.job_id, "queued_cancel");
  assert.equal(queuedCancelled.status, "cancelled");
  assert.equal(queuedCancelled.started_at, null);
  await manager.cancel(running.job_id, "cleanup");

  assert.throws(() => manager.status("missing-job"), /Unknown process job: missing-job/);
  assert.throws(() => manager.output("missing-job", {}), /Unknown process job: missing-job/);
  await assert.rejects(() => manager.cancel("missing-job"), /Unknown process job: missing-job/);

  const owned = manager.start({
    command: "node",
    args: ["-e", "setTimeout(() => {}, 5000)"],
    cwd: "mcp-tests",
  }, { ownerId: "client-a" });
  assert.throws(
    () => manager.status(owned.job_id, { ownerId: "client-b" }),
    /Unknown process job/
  );
  assert.throws(
    () => manager.output(owned.job_id, {}, { ownerId: "client-b" }),
    /Unknown process job/
  );
  await assert.rejects(
    () => manager.cancel(owned.job_id, "cross-client", { ownerId: "client-b" }),
    /Unknown process job/
  );
  await manager.cancel(owned.job_id, "owner-cleanup", { ownerId: "client-a" });

  for (let index = 0; index < 4; index += 1) {
    const job = manager.start({
      command: "node",
      args: ["-e", `process.stdout.write('${index}')`],
      cwd: "mcp-tests",
    });
    await waitFor(() => manager.status(job.job_id).terminal);
  }
  assert.equal(manager.snapshot().terminal_jobs <= config.maxRetained, true);

  const auditText = JSON.stringify(audits);
  assert.equal(auditText.includes("first-secret"), false);
  assert.equal(auditText.includes("audit-secret-value"), false);
  assert.equal(auditText.includes("cancel-secret-value"), false);
  assert.equal(auditText.includes("process_job_queued"), true);
  assert.equal(auditText.includes("process_job_completed"), true);
  assert.equal(audits.every((event) => !Object.hasOwn(event, "args")), true);
  assert.equal(audits.every((event) => !Object.hasOwn(event, "env")), true);
  assert.equal(audits.every((event) => !Object.hasOwn(event, "executable")), true);

  await manager.shutdown("test_shutdown");
  assert.equal(manager.snapshot().running_jobs, 0);
  assert.equal(manager.snapshot().queued_jobs, 0);
  assert.throws(
    () => manager.start({ command: "node", args: ["--version"], cwd: "mcp-tests" }),
    /shutting down/i
  );

  console.log("smoke_process_job_manager ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
