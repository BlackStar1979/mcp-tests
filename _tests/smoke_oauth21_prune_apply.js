"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const {
  buildOAuth21PrunePreview,
} = require("../src/auth/oauth21_prune_preview");
const {
  buildOAuth21PruneReceipt,
} = require("../src/auth/oauth21_prune_receipt");
const {
  evaluateOAuth21PruneApplyReadiness,
} = require("../src/auth/oauth21_prune_apply_gate");
const {
  APPROVAL_MARKER_ID,
} = require("../src/auth/oauth21_prune_apply_package_draft");
const {
  OAUTH21_PRUNE_APPLY_VERSION,
  buildOAuth21PruneApplyPlan,
  executeOAuth21PruneApply,
} = require("../src/auth/oauth21_prune_apply");

const nowMs = Date.parse("2026-07-12T12:00:00.000Z");
const deadClientMinAgeMs = 14 * 86400 * 1000;
const stateBody = {
  access: [
    { token: "access-live", clientId: "active-client", grantId: "grant-live", expiresAt: nowMs + 3600_000 },
    { token: "access-orphan", clientId: "missing-client", grantId: "grant-orphan-a", expiresAt: nowMs + 3600_000 },
  ],
  refresh: [
    { token: "refresh-live", clientId: "active-client", grantId: "grant-live", expiresAt: nowMs + 7200_000 },
    { token: "refresh-orphan", clientId: "missing-client", grantId: "grant-orphan-r", expiresAt: nowMs + 7200_000 },
  ],
  used_refresh: [
    { token: "used-live", clientId: "active-client", grantId: "grant-live", expiresAt: nowMs + 7200_000 },
    { token: "used-orphan", clientId: "missing-client", grantId: "grant-orphan-u", expiresAt: nowMs + 7200_000 },
  ],
};
const clientsList = [
  { client_id: "active-client", client_id_issued_at: Math.floor((nowMs - (2 * 86400 * 1000)) / 1000) },
  { client_id: "dead-old", client_id_issued_at: Math.floor((nowMs - (15 * 86400 * 1000)) / 1000) },
];
const clients = new Map(clientsList.map((item) => [item.client_id, item]));
const accessTokens = new Map(stateBody.access.map((item) => [item.token, item]));
const refreshTokens = new Map(stateBody.refresh.map((item) => [item.token, item]));
const usedRefreshTokens = new Map(stateBody.used_refresh.map((item) => [item.token, item]));
const preview = buildOAuth21PrunePreview({
  clients,
  accessTokens,
  refreshTokens,
  usedRefreshTokens,
  pending: new Map(),
  codes: new Map(),
  nowMs,
  deadClientMinAgeMs,
  oauthStatePath: "C:/secret/tests_oauth_state.json",
  clientsPath: "C:/secret/tests_oauth_clients.json",
});
const receipt = buildOAuth21PruneReceipt({
  preview,
  operator: "operator",
  reason: "apply test",
});
const gate = evaluateOAuth21PruneApplyReadiness({
  preview,
  receipt,
  receiptVerified: true,
  operatorApproval: true,
  backupConfigured: true,
  rollbackConfigured: true,
  auditRedactionReady: true,
  maintenanceWindowReady: true,
  authProfileAllowed: true,
});
const approvalMarker = {
  id: APPROVAL_MARKER_ID,
  approved: true,
  oauth21_prune_authorized: true,
  file_mutation_authorized: true,
  approved_by: "operator",
  approved_at: "2026-07-12T12:00:00.000Z",
};

const dryPlan = buildOAuth21PruneApplyPlan({
  preview,
  receipt,
  gate,
  approvalMarker,
  stateBody,
  clientsList,
  oauthStatePath: "C:/secret/tests_oauth_state.json",
  clientsPath: "C:/secret/tests_oauth_clients.json",
  backupDir: "C:/secret/backups",
  nowMs,
  deadClientMinAgeMs,
});
assert.equal(dryPlan.version, OAUTH21_PRUNE_APPLY_VERSION);
assert.equal(dryPlan.success, true);
assert.equal(dryPlan.apply_allowed_now, false);
assert.equal(dryPlan.execute_performed, false);
assert.equal(dryPlan.receipt_verified, true);
assert.equal(dryPlan.gate_verified, true);
assert.equal(dryPlan.future_ready_if_apply_enabled, true);
assert.equal(dryPlan.candidate_counts.dead_clients_eligible, 1);
assert.equal(dryPlan.candidate_counts.orphan_access_tokens, 1);
assert.equal(dryPlan.candidate_counts.orphan_refresh_tokens, 1);
assert.equal(dryPlan.candidate_counts.orphan_used_refresh_tokens, 1);
assert.equal(dryPlan.candidate_counts.total_candidates, 4);
assert.equal(dryPlan.deletion_counts.clients, 1);
assert.equal(dryPlan.deletion_counts.access_tokens, 1);
assert.equal(dryPlan.deletion_counts.refresh_tokens, 1);
assert.equal(dryPlan.deletion_counts.used_refresh_tokens, 1);
assert.equal(dryPlan.approval_checks.marker_approved, true);
assert.equal(dryPlan.backup_plan.required, true);
assert.equal(dryPlan.raw_identifiers_included, true);
assert.ok(typeof dryPlan.plan_hash === "string");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "oauth21-prune-apply-"));
const oauthStatePath = path.join(tempRoot, "tests_oauth_state.json");
const clientsPath = path.join(tempRoot, "tests_oauth_clients.json");
const backupDir = path.join(tempRoot, "backups");
fs.writeFileSync(oauthStatePath, JSON.stringify(stateBody, null, 2), "utf8");
fs.writeFileSync(clientsPath, JSON.stringify(clientsList, null, 2), "utf8");

const applied = executeOAuth21PruneApply({
  preview,
  receipt,
  gate,
  approvalMarker,
  oauthStatePath,
  clientsPath,
  backupDir,
  nowMs,
  deadClientMinAgeMs,
});
assert.equal(applied.success, true);
assert.equal(applied.execute_requested, true);
assert.equal(applied.execute_performed, true);
assert.ok(fs.existsSync(applied.backup_paths.oauth_state_backup));
assert.ok(fs.existsSync(applied.backup_paths.oauth_clients_backup));
assert.ok(fs.existsSync(applied.receipt_paths.rollback_receipt));
assert.ok(fs.existsSync(applied.receipt_paths.apply_receipt));

const stateAfter = JSON.parse(fs.readFileSync(oauthStatePath, "utf8"));
const clientsAfter = JSON.parse(fs.readFileSync(clientsPath, "utf8"));
assert.equal(stateAfter.access.some((item) => item.token === "access-orphan"), false);
assert.equal(stateAfter.refresh.some((item) => item.token === "refresh-orphan"), false);
assert.equal(stateAfter.used_refresh.some((item) => item.token === "used-orphan"), false);
assert.equal(stateAfter.access.some((item) => item.token === "access-live"), true);
assert.equal(clientsAfter.some((item) => item.client_id === "dead-old"), false);
assert.equal(clientsAfter.some((item) => item.client_id === "active-client"), true);

const denied = executeOAuth21PruneApply({
  preview,
  receipt,
  gate: { ...gate, future_ready_if_apply_enabled: false },
  approvalMarker,
  oauthStatePath,
  clientsPath,
  backupDir,
  nowMs,
  deadClientMinAgeMs,
});
assert.equal(denied.success, false);
assert.equal(denied.execute_performed, false);
assert.ok(denied.missing_requirements.includes("future_ready_if_apply_enabled"));

const sqliteStoragePath = path.join(tempRoot, "tests_oauth.sqlite");
const sqliteBackupDir = path.join(tempRoot, "sqlite-backups");
const sqliteSeedDb = new DatabaseSync(sqliteStoragePath);
try {
  sqliteSeedDb.exec(`
    CREATE TABLE IF NOT EXISTS oauth21_clients (
      client_id TEXT PRIMARY KEY,
      client_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauth21_access_tokens (
      token TEXT PRIMARY KEY,
      token_json TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      client_id TEXT,
      grant_id TEXT
    );
    CREATE TABLE IF NOT EXISTS oauth21_refresh_tokens (
      token TEXT PRIMARY KEY,
      token_json TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      client_id TEXT,
      grant_id TEXT
    );
    CREATE TABLE IF NOT EXISTS oauth21_used_refresh_tokens (
      token TEXT PRIMARY KEY,
      token_json TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      client_id TEXT,
      grant_id TEXT,
      replay_until INTEGER NOT NULL DEFAULT 0
    );
  `);
  const insertClientStmt = sqliteSeedDb.prepare(`
    INSERT INTO oauth21_clients (client_id, client_json, updated_at)
    VALUES (?, ?, ?)
  `);
  const insertAccessStmt = sqliteSeedDb.prepare(`
    INSERT INTO oauth21_access_tokens (token, token_json, expires_at, client_id, grant_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertRefreshStmt = sqliteSeedDb.prepare(`
    INSERT INTO oauth21_refresh_tokens (token, token_json, expires_at, client_id, grant_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertUsedRefreshStmt = sqliteSeedDb.prepare(`
    INSERT INTO oauth21_used_refresh_tokens (token, token_json, expires_at, client_id, grant_id, replay_until)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  sqliteSeedDb.exec("BEGIN IMMEDIATE");
  try {
    for (const client of clientsList) {
      insertClientStmt.run(client.client_id, JSON.stringify(client), nowMs);
    }
    for (const item of stateBody.access) {
      insertAccessStmt.run(item.token, JSON.stringify(item), item.expiresAt, item.clientId || "", item.grantId || "");
    }
    for (const item of stateBody.refresh) {
      insertRefreshStmt.run(item.token, JSON.stringify(item), item.expiresAt, item.clientId || "", item.grantId || "");
    }
    for (const item of stateBody.used_refresh) {
      insertUsedRefreshStmt.run(item.token, JSON.stringify(item), item.expiresAt, item.clientId || "", item.grantId || "", item.replayUntil || 0);
    }
    sqliteSeedDb.exec("COMMIT");
  } catch (error) {
    try { sqliteSeedDb.exec("ROLLBACK"); } catch (_) {}
    throw error;
  }
} finally {
  sqliteSeedDb.close();
}

const sqliteDryPlan = buildOAuth21PruneApplyPlan({
  preview,
  receipt,
  gate,
  approvalMarker,
  stateBody,
  clientsList,
  oauthStoragePath: sqliteStoragePath,
  oauthStatePath: sqliteStoragePath,
  clientsPath: sqliteStoragePath,
  backupDir: sqliteBackupDir,
  nowMs,
  deadClientMinAgeMs,
});
assert.equal(sqliteDryPlan.storage_backend, "sqlite");
assert.equal(sqliteDryPlan.oauth_storage_exists, true);

const sqliteApplied = executeOAuth21PruneApply({
  preview,
  receipt,
  gate,
  approvalMarker,
  oauthStoragePath: sqliteStoragePath,
  oauthStatePath: sqliteStoragePath,
  clientsPath: sqliteStoragePath,
  backupDir: sqliteBackupDir,
  nowMs,
  deadClientMinAgeMs,
});
assert.equal(sqliteApplied.success, true);
assert.equal(sqliteApplied.execute_performed, true);
assert.ok(fs.existsSync(sqliteApplied.backup_paths.oauth_storage_backup));
const sqliteDb = new DatabaseSync(sqliteStoragePath);
try {
  assert.equal(sqliteDb.prepare("SELECT COUNT(*) AS count FROM oauth21_clients WHERE client_id = ?").get("dead-old").count, 0);
  assert.equal(sqliteDb.prepare("SELECT COUNT(*) AS count FROM oauth21_clients WHERE client_id = ?").get("active-client").count, 1);
  assert.equal(sqliteDb.prepare("SELECT COUNT(*) AS count FROM oauth21_access_tokens WHERE token = ?").get("access-orphan").count, 0);
  assert.equal(sqliteDb.prepare("SELECT COUNT(*) AS count FROM oauth21_refresh_tokens WHERE token = ?").get("refresh-orphan").count, 0);
  assert.equal(sqliteDb.prepare("SELECT COUNT(*) AS count FROM oauth21_used_refresh_tokens WHERE token = ?").get("used-orphan").count, 0);
  assert.equal(sqliteDb.prepare("SELECT COUNT(*) AS count FROM oauth21_access_tokens WHERE token = ?").get("access-live").count, 1);
} finally {
  sqliteDb.close();
}

fs.rmSync(tempRoot, { recursive: true, force: true });
console.log("smoke_oauth21_prune_apply ok");
