"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createProcessJobStore } = require("../src/util/process_job_store");

const OWNER_A = "owner-a";
const OWNER_B = "owner-b";

function createJob(store, id, createdAtMs, outputLimit = 5000) {
  store.create({
    id,
    ownerKey: OWNER_A,
    command: "fixture",
    family: "runtime",
    resolutionClass: "fixture",
    cwd: ".",
    workspace: "mcp-tests",
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    spanId: "00f067aa0ba902b7",
    parentSpanId: null,
    traceFlags: "01",
    traceSource: "internal_child",
    createdAtMs,
    timeoutMs: 5000,
    outputLimit,
  });
  store.markRunning(id, createdAtMs + 1);
}

function finishJob(store, id, finishedAtMs, stdout = "done\n", stderr = "") {
  return store.finish(id, {
    status: "ok",
    stdout,
    stderr,
    stdout_truncated: false,
    stderr_truncated: false,
    exit_code: 0,
    signal: null,
    timed_out: false,
    error: null,
  }, finishedAtMs);
}

(() => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-artifact-store-"));
  const storageFile = path.join(tempRoot, "jobs.sqlite");
  let currentTime = 100000;
  const ids = ["11111111111111111111111111111111", "22222222222222222222222222222222"];
  const store = createProcessJobStore({
    storageFile,
    runtimeScope: "artifact-smoke",
    serverInstanceId: "artifact-instance",
    serverPid: 4242,
    processKill: () => { throw new Error("not running"); },
    now: () => currentTime,
    artifactRetentionMs: 60000,
    artifactMaxRetained: 8,
    createArtifactId: () => ids.shift(),
  });

  try {
    createJob(store, "job-a", currentTime);
    const stdout = "A".repeat(1000);
    const stderr = "fixture-error\n";
    finishJob(store, "job-a", currentTime + 10, stdout, stderr);

    const first = store.artifacts("job-a", OWNER_A);
    assert.equal(first.length, 2);
    assert.deepEqual(first.map((item) => item.stream), ["stdout", "stderr"]);
    assert.match(first[0].artifactId, /^[0-9a-f]{32}$/);
    assert.equal(first[0].jobId, "job-a");
    assert.equal(first[0].mimeType, "text/plain; charset=utf-8");
    assert.equal(first[0].chars, stdout.length);
    assert.equal(first[0].bytes, Buffer.byteLength(stdout, "utf8"));
    assert.equal(first[0].sha256, crypto.createHash("sha256").update(stdout, "utf8").digest("hex"));
    assert.equal(first[0].traceId, "4bf92f3577b34da6a3ce929d0e0e4736");
    assert.equal(first[0].spanId, "00f067aa0ba902b7");
    assert.equal(first[0].expiresAtMs, currentTime + 10 + 60000);

    const repeated = store.artifacts("job-a", OWNER_A);
    assert.deepEqual(repeated.map((item) => item.artifactId), first.map((item) => item.artifactId));
    assert.equal(store.artifacts("job-a", OWNER_B), null, "cross-owner artifact enumeration must look absent");

    const chunk = store.readArtifact(first[0].artifactId, OWNER_A, { offset: 100, maxChars: 128 });
    assert.equal(chunk.text, "A".repeat(128));
    assert.equal(chunk.offset, 100);
    assert.equal(chunk.nextOffset, 228);
    assert.equal(chunk.eof, false);
    assert.equal(chunk.sha256, first[0].sha256);
    assert.equal(store.readArtifact(first[0].artifactId, OWNER_B, { offset: 0, maxChars: 128 }), null);

    currentTime += 2000;
    store.prune(currentTime, 1000, 1);
    assert.equal(store.get("job-a", OWNER_A), null);
    const afterJobPrune = store.readArtifact(first[0].artifactId, OWNER_A, { offset: 0, maxChars: 64 });
    assert.equal(afterJobPrune.text, "A".repeat(64));

    currentTime += 60000;
    store.pruneArtifacts(currentTime);
    assert.equal(store.readArtifact(first[0].artifactId, OWNER_A, { offset: 0, maxChars: 64 }), null);
  } finally {
    store.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
})();

(() => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-artifact-collision-"));
  const storageFile = path.join(tempRoot, "jobs.sqlite");
  const idA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const idB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const idC = "cccccccccccccccccccccccccccccccc";
  const idD = "dddddddddddddddddddddddddddddddd";
  const ids = [idA, idB, idA, idC, idD];
  let currentTime = 1000;
  const store = createProcessJobStore({
    storageFile,
    runtimeScope: "artifact-collision",
    serverInstanceId: "artifact-collision-instance",
    serverPid: 4242,
    processKill: () => { throw new Error("not running"); },
    now: () => currentTime,
    artifactRetentionMs: 60000,
    artifactMaxRetained: 8,
    createArtifactId: () => ids.shift(),
  });

  try {
    createJob(store, "job-first", currentTime);
    finishJob(store, "job-first", currentTime + 10, "first\n", "first-error\n");
    const firstArtifacts = store.artifacts("job-first", OWNER_A);
    assert.deepEqual(firstArtifacts.map((item) => item.artifactId), [idA, idB]);

    currentTime = 2000;
    createJob(store, "job-second", currentTime);
    const second = finishJob(store, "job-second", currentTime + 10, "second\n", "second-error\n");
    assert.equal(second.status, "ok", "artifact ID collision must not roll back terminal job persistence");
    const secondArtifacts = store.artifacts("job-second", OWNER_A);
    assert.deepEqual(secondArtifacts.map((item) => item.artifactId), [idC, idD]);
    assert.equal(store.get("job-second", OWNER_A).status, "ok");
  } finally {
    store.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
})();

(() => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-artifact-expiry-"));
  const storageFile = path.join(tempRoot, "jobs.sqlite");
  let currentTime = 500000;
  const ids = [
    "33333333333333333333333333333333",
    "44444444444444444444444444444444",
    "55555555555555555555555555555555",
    "66666666666666666666666666666666",
  ];
  const store = createProcessJobStore({
    storageFile,
    runtimeScope: "artifact-expiry",
    serverInstanceId: "artifact-expiry-instance",
    serverPid: 4242,
    processKill: () => { throw new Error("not running"); },
    now: () => currentTime,
    artifactRetentionMs: 60000,
    artifactMaxRetained: 8,
    createArtifactId: () => ids.shift(),
  });

  try {
    createJob(store, "job-expiry", currentTime);
    finishJob(store, "job-expiry", currentTime + 10, "expires\n", "");
    const original = store.artifacts("job-expiry", OWNER_A);
    assert.equal(original.length, 2);
    const originalId = original[0].artifactId;

    currentTime += 60011;
    store.pruneArtifacts(currentTime);
    assert.equal(store.get("job-expiry", OWNER_A).status, "ok", "source job must still exist for resurrection regression");
    assert.equal(store.readArtifact(originalId, OWNER_A, { offset: 0, maxChars: 64 }), null);
    assert.deepEqual(
      store.artifacts("job-expiry", OWNER_A),
      [],
      "expired artifacts must not be rematerialized from a still-retained terminal job"
    );
    assert.equal(store.readArtifact(originalId, OWNER_A, { offset: 0, maxChars: 64 }), null);
  } finally {
    store.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
})();

console.log("smoke_process_artifact_store ok");
