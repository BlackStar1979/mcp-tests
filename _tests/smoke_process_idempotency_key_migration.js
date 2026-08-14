"use strict";

const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const { createProcessJobManager } = require("../src/util/process_job_manager");
const { PROCESS_RUNNER_CONFIG } = require("../src/util/process_runner_config");

const OLD_OAUTH_SECRET = "legacy-oauth-operator-secret";
const NEW_PROCESS_SECRET = "dedicated-process-idempotency-secret";
const OPERATION = "process_start";
const OWNER = "migration-client";
const INPUT = {
  command: "node",
  args: ["--version"],
  cwd: "mcp-tests",
  idempotency_key: "migration-retry-key",
};

function hmac(secret, key) {
  return createHmac("sha256", secret)
    .update(`${OPERATION}\0${key}`, "utf8")
    .digest("hex");
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-idempotency-migration-"));
const storageFile = path.join(tempRoot, "process-jobs.sqlite");
const config = Object.freeze({
  ...PROCESS_RUNNER_CONFIG,
  maxConcurrent: 0,
  maxQueued: 8,
  maxRetained: 32,
  retentionMs: 60000,
});

let legacyManager;
let migratedManager;
try {
  legacyManager = createProcessJobManager({
    config,
    storageFile,
    runtimeScope: "idempotency-key-migration",
    serverInstanceId: "legacy-runtime",
    idempotencySecret: OLD_OAUTH_SECRET,
  });
  const original = legacyManager.start(INPUT, { ownerId: OWNER });
  assert.equal(original.status, "queued");
  legacyManager.close();
  legacyManager = null;

  migratedManager = createProcessJobManager({
    config,
    storageFile,
    runtimeScope: "idempotency-key-migration",
    serverInstanceId: "migrated-runtime",
    idempotencySecret: NEW_PROCESS_SECRET,
    legacyIdempotencySecret: OLD_OAUTH_SECRET,
  });

  const retry = migratedManager.start(INPUT, { ownerId: OWNER });
  assert.equal(retry.job_id, original.job_id, "legacy retained mapping must survive key separation");
  assert.equal(retry.status, "interrupted", "restart reconciliation must remain authoritative");

  const newKey = "post-migration-key";
  const fresh = migratedManager.start({ ...INPUT, idempotency_key: newKey }, { ownerId: OWNER });
  const db = new DatabaseSync(storageFile);
  try {
    const row = db.prepare(
      "SELECT idempotency_key_hash FROM process_job_idempotency WHERE job_id=?"
    ).get(fresh.job_id);
    assert.ok(row);
    assert.equal(row.idempotency_key_hash, hmac(NEW_PROCESS_SECRET, newKey));
    assert.notEqual(row.idempotency_key_hash, hmac(OLD_OAUTH_SECRET, newKey));
  } finally {
    db.close();
  }
} finally {
  try { legacyManager?.close(); } catch {}
  try { migratedManager?.close(); } catch {}
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log("smoke_process_idempotency_key_migration ok");
