"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const {
  verifyOAuth21PruneReceipt,
} = require("./oauth21_prune_receipt");
const {
  verifyOAuth21PruneApplyReadiness,
} = require("./oauth21_prune_apply_gate");

const OAUTH21_PRUNE_APPLY_VERSION = "test-mcp-oauth21-prune-apply-v1";

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function hashText(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

function readJsonFileOrDefault(filePath, fallback) {
  if (!filePath || !fs.existsSync(filePath)) return { exists: false, value: fallback };
  const raw = fs.readFileSync(filePath, "utf8");
  return { exists: true, value: JSON.parse(raw) };
}

function writeJsonFileAtomic(filePath, value) {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmpPath, filePath);
}

function copyFileIfExists(sourcePath, targetPath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) return false;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  return true;
}

function detectPruneStorageBackend({ oauthStoragePath = "", oauthStatePath = "", clientsPath = "" } = {}) {
  const storagePath = String(oauthStoragePath || "").trim();
  if (storagePath) return { backend: "sqlite", storagePath };
  const statePath = String(oauthStatePath || "").trim();
  const clientPath = String(clientsPath || "").trim();
  if (statePath && clientPath && statePath === clientPath && /\.sqlite$/i.test(statePath)) {
    return { backend: "sqlite", storagePath: statePath };
  }
  return { backend: "json", storagePath: "" };
}

function initSqliteSchema(db) {
  db.exec(`
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
}

function readSqliteState(storagePath) {
  if (!storagePath || !fs.existsSync(storagePath)) {
    return { exists: false, clientsList: [], stateBody: { access: [], refresh: [], used_refresh: [] } };
  }
  const db = new DatabaseSync(storagePath);
  try {
    initSqliteSchema(db);
    const clientsList = db.prepare("SELECT client_json FROM oauth21_clients").all().map((row) => JSON.parse(row.client_json));
    const access = db.prepare("SELECT token_json FROM oauth21_access_tokens").all().map((row) => JSON.parse(row.token_json));
    const refresh = db.prepare("SELECT token_json FROM oauth21_refresh_tokens").all().map((row) => JSON.parse(row.token_json));
    const usedRefresh = db.prepare("SELECT token_json FROM oauth21_used_refresh_tokens").all().map((row) => JSON.parse(row.token_json));
    return {
      exists: true,
      clientsList,
      stateBody: {
        access,
        refresh,
        used_refresh: usedRefresh,
      },
    };
  } finally {
    db.close();
  }
}

function writeSqliteState(storagePath, { clientsList = [], stateBody = {}, nowMs = Date.now() } = {}) {
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  const db = new DatabaseSync(storagePath);
  try {
    initSqliteSchema(db);
    const insertClientStmt = db.prepare(`
      INSERT INTO oauth21_clients (client_id, client_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET
        client_json = excluded.client_json,
        updated_at = excluded.updated_at
    `);
    const insertAccessStmt = db.prepare(`
      INSERT INTO oauth21_access_tokens (token, token_json, expires_at, client_id, grant_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertRefreshStmt = db.prepare(`
      INSERT INTO oauth21_refresh_tokens (token, token_json, expires_at, client_id, grant_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertUsedRefreshStmt = db.prepare(`
      INSERT INTO oauth21_used_refresh_tokens (token, token_json, expires_at, client_id, grant_id, replay_until)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec("DELETE FROM oauth21_clients");
      db.exec("DELETE FROM oauth21_access_tokens");
      db.exec("DELETE FROM oauth21_refresh_tokens");
      db.exec("DELETE FROM oauth21_used_refresh_tokens");
      for (const client of Array.isArray(clientsList) ? clientsList : []) {
        if (!client?.client_id) continue;
        insertClientStmt.run(String(client.client_id), JSON.stringify(client), Number(nowMs));
      }
      for (const item of Array.isArray(stateBody.access) ? stateBody.access : []) {
        if (!item?.token) continue;
        insertAccessStmt.run(String(item.token), JSON.stringify(item), Number(item.expiresAt || 0), String(item.clientId || ""), String(item.grantId || ""));
      }
      for (const item of Array.isArray(stateBody.refresh) ? stateBody.refresh : []) {
        if (!item?.token) continue;
        insertRefreshStmt.run(String(item.token), JSON.stringify(item), Number(item.expiresAt || 0), String(item.clientId || ""), String(item.grantId || ""));
      }
      for (const item of Array.isArray(stateBody.used_refresh) ? stateBody.used_refresh : []) {
        if (!item?.token) continue;
        insertUsedRefreshStmt.run(
          String(item.token),
          JSON.stringify(item),
          Number(item.expiresAt || 0),
          String(item.clientId || ""),
          String(item.grantId || ""),
          Number(item.replayUntil || 0),
        );
      }
      db.exec("COMMIT");
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch (_) {}
      throw error;
    }
  } finally {
    db.close();
  }
}

function isActiveTokenItem(item, nowMs) {
  return Boolean(item && item.token && Number(item.expiresAt || 0) > nowMs);
}

function collectReferencedClientIdsFromState(stateBody = {}, nowMs = Date.now(), extraReferencedClientIds = []) {
  const referenced = new Set();
  for (const item of Array.isArray(stateBody.access) ? stateBody.access : []) {
    if (isActiveTokenItem(item, nowMs) && item.clientId) referenced.add(String(item.clientId));
  }
  for (const item of Array.isArray(stateBody.refresh) ? stateBody.refresh : []) {
    if (isActiveTokenItem(item, nowMs) && item.clientId) referenced.add(String(item.clientId));
  }
  for (const item of Array.isArray(stateBody.used_refresh) ? stateBody.used_refresh : []) {
    if (isActiveTokenItem(item, nowMs) && item.clientId && item.grantId) referenced.add(String(item.clientId));
  }
  for (const item of Array.isArray(extraReferencedClientIds) ? extraReferencedClientIds : []) {
    if (item) referenced.add(String(item));
  }
  return referenced;
}

function collectRawPruneCandidates({
  clientsList = [],
  stateBody = {},
  nowMs = Date.now(),
  deadClientMinAgeMs,
  extraReferencedClientIds = [],
} = {}) {
  const referencedClientIds = collectReferencedClientIdsFromState(stateBody, nowMs, extraReferencedClientIds);
  const deadClientsEligible = [];
  const deadClientsDeferred = [];

  for (const client of Array.isArray(clientsList) ? clientsList : []) {
    const clientId = String(client?.client_id || "");
    if (!clientId || referencedClientIds.has(clientId)) continue;
    const issuedAtMs = Number(client?.client_id_issued_at || 0) * 1000;
    const ageMs = issuedAtMs > 0 ? Math.max(0, nowMs - issuedAtMs) : 0;
    const item = { client_id: clientId, age_ms: ageMs };
    if (ageMs >= deadClientMinAgeMs) deadClientsEligible.push(item);
    else deadClientsDeferred.push(item);
  }

  const orphanAccessTokens = [];
  const orphanRefreshTokens = [];
  const orphanUsedRefreshTokens = [];
  const clientsSet = new Set((Array.isArray(clientsList) ? clientsList : []).map((item) => String(item?.client_id || "")).filter(Boolean));

  for (const item of Array.isArray(stateBody.access) ? stateBody.access : []) {
    if (isActiveTokenItem(item, nowMs) && !clientsSet.has(String(item?.clientId || ""))) {
      orphanAccessTokens.push({ token: String(item.token), client_id: String(item.clientId || ""), grant_id: String(item.grantId || "") });
    }
  }
  for (const item of Array.isArray(stateBody.refresh) ? stateBody.refresh : []) {
    if (isActiveTokenItem(item, nowMs) && !clientsSet.has(String(item?.clientId || ""))) {
      orphanRefreshTokens.push({ token: String(item.token), client_id: String(item.clientId || ""), grant_id: String(item.grantId || "") });
    }
  }
  for (const item of Array.isArray(stateBody.used_refresh) ? stateBody.used_refresh : []) {
    if (isActiveTokenItem(item, nowMs) && item.grantId && !clientsSet.has(String(item?.clientId || ""))) {
      orphanUsedRefreshTokens.push({ token: String(item.token), client_id: String(item.clientId || ""), grant_id: String(item.grantId || "") });
    }
  }

  return {
    dead_clients_eligible: deadClientsEligible,
    dead_clients_deferred: deadClientsDeferred,
    orphan_access_tokens: orphanAccessTokens,
    orphan_refresh_tokens: orphanRefreshTokens,
    orphan_used_refresh_tokens: orphanUsedRefreshTokens,
  };
}

function buildApprovalChecks(approvalMarker = {}) {
  return {
    marker_present: Boolean(approvalMarker && typeof approvalMarker === "object"),
    marker_approved: approvalMarker?.approved === true,
    prune_authorized: approvalMarker?.oauth21_prune_authorized === true,
    file_mutation_authorized: approvalMarker?.file_mutation_authorized === true,
  };
}

function buildOAuth21PruneApplyPlan({
  preview = {},
  receipt = {},
  gate = {},
  approvalMarker = {},
  stateBody = {},
  clientsList = [],
  oauthStoragePath = "",
  oauthStatePath = "",
  clientsPath = "",
  backupDir = "",
  nowMs = Date.now(),
  deadClientMinAgeMs,
  extraReferencedClientIds = [],
} = {}) {
  const receiptVerification = verifyOAuth21PruneReceipt(receipt);
  const gateVerification = verifyOAuth21PruneApplyReadiness(gate);
  const approvalChecks = buildApprovalChecks(approvalMarker);
  const storage = detectPruneStorageBackend({ oauthStoragePath, oauthStatePath, clientsPath });
  const candidates = collectRawPruneCandidates({
    clientsList,
    stateBody,
    nowMs,
    deadClientMinAgeMs,
    extraReferencedClientIds,
  });

  const clientIdsToDelete = new Set(candidates.dead_clients_eligible.map((item) => item.client_id));
  const accessTokensToDelete = new Set(candidates.orphan_access_tokens.map((item) => item.token));
  const refreshTokensToDelete = new Set(candidates.orphan_refresh_tokens.map((item) => item.token));
  const usedRefreshTokensToDelete = new Set(candidates.orphan_used_refresh_tokens.map((item) => item.token));

  const proposedClientsList = (Array.isArray(clientsList) ? clientsList : []).filter((item) => !clientIdsToDelete.has(String(item?.client_id || "")));
  const proposedStateBody = {
    ...stateBody,
    access: (Array.isArray(stateBody.access) ? stateBody.access : []).filter((item) => !accessTokensToDelete.has(String(item?.token || ""))),
    refresh: (Array.isArray(stateBody.refresh) ? stateBody.refresh : []).filter((item) => !refreshTokensToDelete.has(String(item?.token || ""))),
    used_refresh: (Array.isArray(stateBody.used_refresh) ? stateBody.used_refresh : []).filter((item) => !usedRefreshTokensToDelete.has(String(item?.token || ""))),
  };

  const counts = {
    dead_clients_eligible: candidates.dead_clients_eligible.length,
    dead_clients_deferred: candidates.dead_clients_deferred.length,
    orphan_access_tokens: candidates.orphan_access_tokens.length,
    orphan_refresh_tokens: candidates.orphan_refresh_tokens.length,
    orphan_used_refresh_tokens: candidates.orphan_used_refresh_tokens.length,
  };
  counts.total_candidates = counts.dead_clients_eligible + counts.orphan_access_tokens + counts.orphan_refresh_tokens + counts.orphan_used_refresh_tokens;

  const planCore = {
    version: OAUTH21_PRUNE_APPLY_VERSION,
    success: receiptVerification.success === true && gateVerification.success === true,
    mode: "oauth21-prune-apply-plan",
    apply_allowed_now: false,
    execute_requested: false,
    execute_performed: false,
    preview_hash: String(preview.preview_hash || ""),
    receipt_hash: String(receipt.receipt_hash || ""),
    gate_hash: String(gate.gate_hash || ""),
    receipt_verified: receiptVerification.success === true,
    gate_verified: gateVerification.success === true,
    future_ready_if_apply_enabled: gate.future_ready_if_apply_enabled === true,
    approval_checks: approvalChecks,
    storage_backend: storage.backend,
    oauth_storage_exists: storage.backend === "sqlite" ? Boolean(storage.storagePath && fs.existsSync(storage.storagePath)) : false,
    backup_dir_configured: Boolean(String(backupDir || "").trim()),
    oauth_state_exists: Boolean(oauthStatePath && fs.existsSync(oauthStatePath)),
    oauth_clients_exists: Boolean(clientsPath && fs.existsSync(clientsPath)),
    state_before_hash: hashJson(stateBody),
    clients_before_hash: hashJson(clientsList),
    state_after_hash: hashJson(proposedStateBody),
    clients_after_hash: hashJson(proposedClientsList),
    would_write_state: hashJson(stateBody) !== hashJson(proposedStateBody),
    would_write_clients: hashJson(clientsList) !== hashJson(proposedClientsList),
    candidate_counts: counts,
    deletion_counts: {
      clients: clientIdsToDelete.size,
      access_tokens: accessTokensToDelete.size,
      refresh_tokens: refreshTokensToDelete.size,
      used_refresh_tokens: usedRefreshTokensToDelete.size,
    },
    backup_plan: {
      required: counts.total_candidates > 0,
      backup_dir: String(backupDir || ""),
      raw_paths_included: true,
    },
    rollback_receipt_required: counts.total_candidates > 0,
    post_apply_verification_required: true,
    raw_identifiers_included: true,
    candidates,
    proposed_state_body: proposedStateBody,
    proposed_clients_list: proposedClientsList,
  };

  return {
    ...planCore,
    plan_hash: hashJson(planCore),
  };
}

function executeOAuth21PruneApply({
  preview = {},
  receipt = {},
  gate = {},
  approvalMarker = {},
  oauthStoragePath = "",
  oauthStatePath = "",
  clientsPath = "",
  backupDir = "",
  nowMs = Date.now(),
  deadClientMinAgeMs,
  extraReferencedClientIds = [],
} = {}) {
  const storage = detectPruneStorageBackend({ oauthStoragePath, oauthStatePath, clientsPath });
  const stateLoad = storage.backend === "sqlite"
    ? readSqliteState(storage.storagePath)
    : readJsonFileOrDefault(oauthStatePath, {});
  const clientsLoad = storage.backend === "sqlite"
    ? { exists: stateLoad.exists, value: stateLoad.clientsList }
    : readJsonFileOrDefault(clientsPath, []);
  const plan = buildOAuth21PruneApplyPlan({
    preview,
    receipt,
    gate,
    approvalMarker,
    stateBody: storage.backend === "sqlite" ? stateLoad.stateBody : stateLoad.value,
    clientsList: clientsLoad.value,
    oauthStoragePath: storage.storagePath,
    oauthStatePath,
    clientsPath,
    backupDir,
    nowMs,
    deadClientMinAgeMs,
    extraReferencedClientIds,
  });

  const missing = [];
  if (plan.receipt_verified !== true) missing.push("receipt_verified");
  if (plan.gate_verified !== true) missing.push("gate_verified");
  if (plan.future_ready_if_apply_enabled !== true) missing.push("future_ready_if_apply_enabled");
  if (plan.approval_checks.marker_approved !== true) missing.push("approval_marker.approved");
  if (plan.approval_checks.prune_authorized !== true) missing.push("approval_marker.oauth21_prune_authorized");
  if (plan.approval_checks.file_mutation_authorized !== true) missing.push("approval_marker.file_mutation_authorized");
  if (!String(backupDir || "").trim()) missing.push("backupDir");

  if (missing.length > 0) {
    return {
      ...plan,
      success: false,
      error: `oauth21 prune apply denied: ${missing.join(", ")}`,
      execute_requested: true,
      execute_performed: false,
      missing_requirements: missing,
    };
  }

  const operationId = `oauth21-prune-${process.pid}-${nowMs}`;
  fs.mkdirSync(backupDir, { recursive: true });
  const stateBackupPath = path.join(backupDir, `${operationId}.oauth_state.backup.json`);
  const clientsBackupPath = path.join(backupDir, `${operationId}.oauth_clients.backup.json`);
  const storageBackupPath = path.join(backupDir, `${operationId}.oauth_storage.backup.sqlite`);
  const rollbackReceiptPath = path.join(backupDir, `${operationId}.rollback-receipt.json`);
  const applyReceiptPath = path.join(backupDir, `${operationId}.apply-receipt.json`);

  const stateBackedUp = storage.backend === "sqlite" ? false : copyFileIfExists(oauthStatePath, stateBackupPath);
  const clientsBackedUp = storage.backend === "sqlite" ? false : copyFileIfExists(clientsPath, clientsBackupPath);
  const storageBackedUp = storage.backend === "sqlite" ? copyFileIfExists(storage.storagePath, storageBackupPath) : false;

  const rollbackReceipt = {
    version: OAUTH21_PRUNE_APPLY_VERSION,
    mode: "oauth21-prune-rollback-receipt",
    operation_id: operationId,
    created_at: new Date(nowMs).toISOString(),
    oauth_storage_path: storage.backend === "sqlite" ? storage.storagePath : "",
    oauth_storage_backup_path: storageBackedUp ? storageBackupPath : "",
    oauth_state_backup_path: stateBackedUp ? stateBackupPath : "",
    oauth_clients_backup_path: clientsBackedUp ? clientsBackupPath : "",
    state_before_hash: plan.state_before_hash,
    clients_before_hash: plan.clients_before_hash,
    candidate_counts: plan.candidate_counts,
    deletion_counts: plan.deletion_counts,
    approval_marker_id: String(approvalMarker?.id || ""),
  };
  writeJsonFileAtomic(rollbackReceiptPath, rollbackReceipt);

  if (storage.backend === "sqlite") {
    writeSqliteState(storage.storagePath, {
      clientsList: plan.proposed_clients_list,
      stateBody: plan.proposed_state_body,
      nowMs,
    });
  } else {
    writeJsonFileAtomic(oauthStatePath, plan.proposed_state_body);
    writeJsonFileAtomic(clientsPath, plan.proposed_clients_list);
  }

  const stateAfterLoad = storage.backend === "sqlite"
    ? readSqliteState(storage.storagePath)
    : readJsonFileOrDefault(oauthStatePath, {});
  const stateAfter = storage.backend === "sqlite" ? stateAfterLoad.stateBody : stateAfterLoad.value;
  const clientsAfter = storage.backend === "sqlite" ? stateAfterLoad.clientsList : readJsonFileOrDefault(clientsPath, []).value;
  const applyReceipt = {
    version: OAUTH21_PRUNE_APPLY_VERSION,
    mode: "oauth21-prune-apply-receipt",
    operation_id: operationId,
    applied_at: new Date(nowMs).toISOString(),
    oauth_storage_path: storage.backend === "sqlite" ? storage.storagePath : "",
    oauth_storage_backup_path: storageBackedUp ? storageBackupPath : "",
    oauth_state_path: oauthStatePath,
    oauth_clients_path: clientsPath,
    rollback_receipt_path: rollbackReceiptPath,
    oauth_state_backup_path: stateBackedUp ? stateBackupPath : "",
    oauth_clients_backup_path: clientsBackedUp ? clientsBackupPath : "",
    state_before_hash: plan.state_before_hash,
    state_after_hash: hashJson(stateAfter),
    clients_before_hash: plan.clients_before_hash,
    clients_after_hash: hashJson(clientsAfter),
    candidate_counts: plan.candidate_counts,
    deletion_counts: plan.deletion_counts,
    approval_marker_id: String(approvalMarker?.id || ""),
  };
  applyReceipt.receipt_hash = hashText(JSON.stringify(applyReceipt));
  writeJsonFileAtomic(applyReceiptPath, applyReceipt);

  return {
    ...plan,
    success: true,
    error: "",
    execute_requested: true,
    execute_performed: true,
    operation_id: operationId,
    backup_paths: {
      oauth_storage_backup: storageBackedUp ? storageBackupPath : "",
      oauth_state_backup: stateBackedUp ? stateBackupPath : "",
      oauth_clients_backup: clientsBackedUp ? clientsBackupPath : "",
    },
    receipt_paths: {
      rollback_receipt: rollbackReceiptPath,
      apply_receipt: applyReceiptPath,
    },
    state_after_hash: applyReceipt.state_after_hash,
    clients_after_hash: applyReceipt.clients_after_hash,
  };
}

module.exports = {
  OAUTH21_PRUNE_APPLY_VERSION,
  buildOAuth21PruneApplyPlan,
  collectRawPruneCandidates,
  executeOAuth21PruneApply,
};
