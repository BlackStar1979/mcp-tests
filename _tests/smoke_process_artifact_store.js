"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createProcessJobStore } = require("../src/util/process_job_store");

const OWNER_A = "owner-a";
const OWNER_B = "owner-b";

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
    store.create({
      id: "job-a",
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
      createdAtMs: currentTime,
      timeoutMs: 5000,
      outputLimit: 5000,
    });
    store.markRunning("job-a", currentTime + 1);
    const stdout = "A".repeat(1000);
    const stderr = "fixture-error\n";
    store.finish("job-a", {
      status: "ok",
      stdout,
      stderr,
      stdout_truncated: false,
      stderr_truncated: false,
      exit_code: 0,
      signal: null,
      timed_out: false,
      error: null,
    }, currentTime + 10);

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

    // Job retention is shorter than artifact retention. Pruning the execution must
    // not invalidate an already-materialized immutable artifact.
    currentTime += 2000;
    store.prune(currentTime, 1000, 1);
    assert.equal(store.get("job-a", OWNER_A), null);
    const afterJobPrune = store.readArtifact(first[0].artifactId, OWNER_A, { offset: 0, maxChars: 64 });
    assert.equal(afterJobPrune.text, "A".repeat(64));

    currentTime += 60000;
    store.pruneArtifacts(currentTime);
    assert.equal(store.readArtifact(first[0].artifactId, OWNER_A, { offset: 0, maxChars: 64 }), null);

    console.log("smoke_process_artifact_store ok");
  } finally {
    store.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
})();
