"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const { runOAuth21StartupPrune } = require("../src/auth/oauth21_startup_prune");

function openSeededDatabase(storageFile, nowMs) {
  const db = new DatabaseSync(storageFile);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE oauth21_clients (
      client_id TEXT PRIMARY KEY,
      client_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE oauth21_access_tokens (
      token TEXT PRIMARY KEY,
      token_json TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      client_id TEXT,
      grant_id TEXT
    );
    CREATE TABLE oauth21_refresh_tokens (
      token TEXT PRIMARY KEY,
      token_json TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      client_id TEXT,
      grant_id TEXT
    );
    CREATE TABLE oauth21_used_refresh_tokens (
      token TEXT PRIMARY KEY,
      token_json TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      client_id TEXT,
      grant_id TEXT,
      replay_until INTEGER NOT NULL DEFAULT 0
    );
  `);
  const insertClient = db.prepare(
    "INSERT INTO oauth21_clients (client_id, client_json, updated_at) VALUES (?, ?, ?)",
  );
  const old = nowMs - (20 * 86400 * 1000);
  const recent = nowMs - (2 * 86400 * 1000);
  for (const [clientId, updatedAt] of [
    ["dead-old", old],
    ["deferred-recent", recent],
    ["active-old", old],
  ]) {
    insertClient.run(clientId, JSON.stringify({ client_id: clientId }), updatedAt);
  }
  const activeToken = {
    token: "active-access",
    clientId: "active-old",
    grantId: "grant-active",
    expiresAt: nowMs + 3600000,
  };
  db.prepare(`
    INSERT INTO oauth21_access_tokens (token, token_json, expires_at, client_id, grant_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    activeToken.token,
    JSON.stringify(activeToken),
    activeToken.expiresAt,
    activeToken.clientId,
    activeToken.grantId,
  );
  const orphanRefresh = {
    token: "orphan-refresh",
    clientId: "missing-client",
    grantId: "grant-orphan",
    expiresAt: nowMs + 86400000,
  };
  db.prepare(`
    INSERT INTO oauth21_refresh_tokens (token, token_json, expires_at, client_id, grant_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    orphanRefresh.token,
    JSON.stringify(orphanRefresh),
    orphanRefresh.expiresAt,
    orphanRefresh.clientId,
    orphanRefresh.grantId,
  );
  db.close();
}

function scalar(storageFile, sql) {
  const db = new DatabaseSync(storageFile, { readOnly: true });
  try {
    return Number(Object.values(db.prepare(sql).get())[0]);
  } finally {
    db.close();
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-oauth-startup-prune-"));
const storageFile = path.join(tmp, "oauth.sqlite");
const backupDir = path.join(tmp, "backups");
const nowMs = Date.parse("2026-07-29T19:00:00.000Z");
openSeededDatabase(storageFile, nowMs);

const events = [];
const applied = runOAuth21StartupPrune({
  storageFile,
  backupDir,
  nowMs,
  onAudit: (event, data) => events.push({ event, data }),
});
assert.equal(applied.success, true);
assert.equal(applied.status, "applied");
assert.deepEqual(applied.deleted, {
  clients: 1,
  access_tokens: 0,
  refresh_tokens: 1,
  used_refresh_tokens: 0,
});
assert.equal(scalar(storageFile, "SELECT COUNT(*) FROM oauth21_clients"), 2);
assert.equal(scalar(storageFile, "SELECT COUNT(*) FROM oauth21_clients WHERE client_id = 'dead-old'"), 0);
assert.equal(scalar(storageFile, "SELECT COUNT(*) FROM oauth21_clients WHERE client_id = 'deferred-recent'"), 1);
assert.equal(scalar(storageFile, "SELECT COUNT(*) FROM oauth21_clients WHERE client_id = 'active-old'"), 1);
assert.equal(scalar(storageFile, "SELECT COUNT(*) FROM oauth21_refresh_tokens WHERE token = 'orphan-refresh'"), 0);
assert.equal(fs.existsSync(applied.backup_path), true);
assert.equal(fs.existsSync(applied.rollback_receipt_path), true);
assert.equal(fs.existsSync(applied.apply_receipt_path), true);
assert.ok(events.some((entry) => entry.event === "oauth21_startup_prune_applied"));

const backup = new DatabaseSync(applied.backup_path, { readOnly: true });
try {
  assert.equal(backup.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  assert.equal(
    Number(backup.prepare("SELECT COUNT(*) AS count FROM oauth21_clients WHERE client_id = 'dead-old'").get().count),
    1,
  );
  const clientIdColumn = backup.prepare("PRAGMA table_info(oauth21_clients)").all()
    .find((column) => column.name === "client_id");
  assert.equal(clientIdColumn.pk, 1);
} finally {
  backup.close();
}

const skipped = runOAuth21StartupPrune({
  storageFile,
  backupDir,
  nowMs: nowMs + 60000,
  onAudit: (event, data) => events.push({ event, data }),
});
assert.equal(skipped.success, true);
assert.equal(skipped.status, "interval_not_elapsed");
assert.ok(events.some((entry) => entry.event === "oauth21_startup_prune_skipped"));

const failureStorage = path.join(tmp, "failure.sqlite");
openSeededDatabase(failureStorage, nowMs);
const invalidBackupDir = path.join(tmp, "backup-path-is-file");
fs.writeFileSync(invalidBackupDir, "not a directory", "utf8");
const failed = runOAuth21StartupPrune({
  storageFile: failureStorage,
  backupDir: invalidBackupDir,
  nowMs,
});
assert.equal(failed.success, false);
assert.equal(failed.status, "backup_failed");
assert.equal(scalar(failureStorage, "SELECT COUNT(*) FROM oauth21_clients WHERE client_id = 'dead-old'"), 1);
assert.equal(scalar(failureStorage, "SELECT COUNT(*) FROM oauth21_refresh_tokens WHERE token = 'orphan-refresh'"), 1);

const receiptFailureStorage = path.join(tmp, "receipt-failure.sqlite");
const receiptFailureBackupDir = path.join(tmp, "receipt-failure-backups");
openSeededDatabase(receiptFailureStorage, nowMs);
let receiptWrites = 0;
const receiptEvents = [];
const appliedWithoutReceipt = runOAuth21StartupPrune({
  storageFile: receiptFailureStorage,
  backupDir: receiptFailureBackupDir,
  nowMs,
  onAudit: (event, data) => receiptEvents.push({ event, data }),
  writeReceipt: (filePath, value) => {
    receiptWrites += 1;
    if (receiptWrites === 2) throw new Error("injected_apply_receipt_failure");
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  },
});
assert.equal(appliedWithoutReceipt.success, true);
assert.equal(appliedWithoutReceipt.status, "applied");
assert.equal(appliedWithoutReceipt.apply_receipt_written, false);
assert.match(appliedWithoutReceipt.apply_receipt_error, /injected_apply_receipt_failure/);
assert.equal(
  scalar(receiptFailureStorage, "SELECT COUNT(*) FROM oauth21_clients WHERE client_id = 'dead-old'"),
  0,
);
assert.ok(receiptEvents.some((entry) => entry.event === "oauth21_startup_prune_receipt_failed"));

const integratedStorage = path.join(tmp, "integrated.sqlite");
const integratedBackupDir = path.join(tmp, "integrated-backups");
openSeededDatabase(integratedStorage, nowMs);
const child = spawnSync(process.execPath, [
  "-e",
  `
    const { createOAuth21AuthorizationServer } = require("./src/auth/oauth21_authorization_server");
    const nowMs = Number(process.argv[3]);
    const server = createOAuth21AuthorizationServer({
      issuer: "https://example.test",
      resource: "https://example.test/mcp",
      operatorSecret: "startup-prune-test-secret",
      storageFile: process.argv[1],
      startupPruneEnabled: true,
      startupPruneBackupDir: process.argv[2],
      now: () => nowMs,
    });
    const registration = server.registerClient({
      redirect_uris: ["https://client.example/callback"],
      token_endpoint_auth_method: "none",
    });
    process.stdout.write(JSON.stringify({
      startup_prune: server.status().startup_prune,
      clients: server.status().clients,
      registration_status: registration.status,
    }));
  `,
  integratedStorage,
  integratedBackupDir,
  String(nowMs),
], { cwd: path.resolve(__dirname, ".."), encoding: "utf8" });
assert.equal(child.status, 0, child.stderr);
const integrated = JSON.parse(child.stdout);
assert.equal(integrated.startup_prune.status, "applied");
assert.equal(integrated.clients, 3);
assert.equal(integrated.registration_status, 201);
assert.equal(scalar(integratedStorage, "SELECT COUNT(*) FROM oauth21_clients WHERE client_id = 'dead-old'"), 0);

fs.rmSync(tmp, { recursive: true, force: true });
console.log("smoke_oauth21_startup_prune ok");
