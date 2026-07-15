"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

function choosePreferredRefreshToken(currentItem, candidateItem) {
  if (!currentItem) return candidateItem;
  if (!candidateItem) return currentItem;
  const currentExpiry = Number(currentItem.expiresAt || 0);
  const candidateExpiry = Number(candidateItem.expiresAt || 0);
  if (candidateExpiry !== currentExpiry) return candidateExpiry > currentExpiry ? candidateItem : currentItem;
  return String(candidateItem.token || "") > String(currentItem.token || "") ? candidateItem : currentItem;
}

function parseOAuthStateBody(body = {}, nowMs = Date.now()) {
  const access = new Map();
  const refresh = new Map();
  const usedRefresh = new Map();
  let expiredAccess = 0;
  let expiredRefresh = 0;
  let expiredUsedRefresh = 0;
  for (const item of Array.isArray(body.access) ? body.access : []) {
    if (item && item.token && item.expiresAt > nowMs) access.set(String(item.token), item);
    else expiredAccess += 1;
  }
  for (const item of Array.isArray(body.refresh) ? body.refresh : []) {
    if (item && item.token && item.expiresAt > nowMs) refresh.set(String(item.token), item);
    else expiredRefresh += 1;
  }
  for (const item of Array.isArray(body.used_refresh) ? body.used_refresh : []) {
    if (item && item.token && item.expiresAt > nowMs && item.grantId) usedRefresh.set(String(item.token), item);
    else expiredUsedRefresh += 1;
  }
  return {
    access,
    refresh,
    usedRefresh,
    expiredAccess,
    expiredRefresh,
    expiredUsedRefresh,
  };
}

function readJsonArray(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return { exists: false, items: [] };
  const raw = fs.readFileSync(filePath, "utf8") || "[]";
  const parsed = JSON.parse(raw);
  return { exists: true, items: Array.isArray(parsed) ? parsed : [] };
}

function readJsonObject(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return { exists: false, body: {} };
  const raw = fs.readFileSync(filePath, "utf8") || "{}";
  return { exists: true, body: JSON.parse(raw) };
}

function createOAuth21PersistenceStore({
  storageFile,
  clientsPath,
  oauthStatePath,
  canonicalResource = "",
  resourceAliases = [],
  now = () => Date.now(),
  onAudit,
  warnLogger = console.warn,
} = {}) {
  const backend = "sqlite";
  const resolvedStorageFile = path.resolve(String(storageFile || ""));
  if (!resolvedStorageFile) throw new Error("oauth21_storage_file_required");
  fs.mkdirSync(path.dirname(resolvedStorageFile), { recursive: true });
  const db = new DatabaseSync(resolvedStorageFile);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
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

  const countClientsStmt = db.prepare("SELECT COUNT(*) AS count FROM oauth21_clients");
  const countAccessStmt = db.prepare("SELECT COUNT(*) AS count FROM oauth21_access_tokens");
  const countRefreshStmt = db.prepare("SELECT COUNT(*) AS count FROM oauth21_refresh_tokens");
  const countUsedRefreshStmt = db.prepare("SELECT COUNT(*) AS count FROM oauth21_used_refresh_tokens");
  const selectClientsStmt = db.prepare("SELECT client_json FROM oauth21_clients");
  const selectAccessStmt = db.prepare("SELECT token_json FROM oauth21_access_tokens");
  const selectRefreshStmt = db.prepare("SELECT token_json FROM oauth21_refresh_tokens");
  const selectUsedRefreshStmt = db.prepare("SELECT token_json FROM oauth21_used_refresh_tokens");
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
  const deleteExpiredAccessStmt = db.prepare("DELETE FROM oauth21_access_tokens WHERE expires_at <= ?");
  const deleteExpiredRefreshStmt = db.prepare("DELETE FROM oauth21_refresh_tokens WHERE expires_at <= ?");
  const deleteExpiredUsedRefreshStmt = db.prepare("DELETE FROM oauth21_used_refresh_tokens WHERE expires_at <= ?");
  const countExpiredAccessStmt = db.prepare("SELECT COUNT(*) AS count FROM oauth21_access_tokens WHERE expires_at <= ?");
  const countExpiredRefreshStmt = db.prepare("SELECT COUNT(*) AS count FROM oauth21_refresh_tokens WHERE expires_at <= ?");
  const countExpiredUsedRefreshStmt = db.prepare("SELECT COUNT(*) AS count FROM oauth21_used_refresh_tokens WHERE expires_at <= ?");
  const clearAccessStmt = db.prepare("DELETE FROM oauth21_access_tokens");
  const clearRefreshStmt = db.prepare("DELETE FROM oauth21_refresh_tokens");
  const clearUsedRefreshStmt = db.prepare("DELETE FROM oauth21_used_refresh_tokens");

  function withTransaction(fn) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch (_) {}
      throw error;
    }
  }

  function tableCounts() {
    return {
      clients: Number(countClientsStmt.get().count || 0),
      access: Number(countAccessStmt.get().count || 0),
      refresh: Number(countRefreshStmt.get().count || 0),
      usedRefresh: Number(countUsedRefreshStmt.get().count || 0),
    };
  }

  function auditLog(name, payload = {}) {
    if (typeof onAudit !== "function") return;
    try {
      onAudit(name, payload);
    } catch (error) {
      warnLogger("OAUTH21_PERSISTENCE_AUDIT_LOG_FAILED:", error?.message || String(error));
    }
  }

  function matchesImportedResource(item) {
    const expected = String(canonicalResource || "").trim();
    if (!expected) return true;
    const actual = String(item?.resource || "").trim();
    if (!actual) return false;
    if (actual === expected) return true;
    return resourceAliases.some((alias) => String(alias || "").trim() === actual);
  }

  function retireLegacyFile(filePath, retiredAtMs) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const suffix = new Date(retiredAtMs).toISOString().replace(/[:.]/g, "-");
    const target = `${filePath}.migrated-${suffix}`;
    fs.renameSync(filePath, target);
    return target;
  }

  function bootstrapFromLegacyIfEmpty(nowMs = now()) {
    const bootstrapResult = withTransaction(() => {
      const counts = tableCounts();
      if (counts.clients > 0 || counts.access > 0 || counts.refresh > 0 || counts.usedRefresh > 0) {
        return { imported: false };
      }
      const legacyClients = readJsonArray(clientsPath);
      const legacyState = readJsonObject(oauthStatePath);
      const parsedState = parseOAuthStateBody(legacyState.body, nowMs);
      if (!legacyClients.exists && !legacyState.exists) return { imported: false };
      const t = nowMs;
      const importedClientIds = new Set();
      let importedClients = 0;
      let importedAccess = 0;
      let importedRefresh = 0;
      let importedUsedRefresh = 0;
      let prunedResourceMismatch = 0;
      let prunedMissingClient = 0;
      for (const client of legacyClients.items) {
        if (!client?.client_id) continue;
        insertClientStmt.run(String(client.client_id), JSON.stringify(client), t);
        importedClientIds.add(String(client.client_id));
        importedClients += 1;
      }
      for (const item of parsedState.access.values()) {
        if (!matchesImportedResource(item)) {
          prunedResourceMismatch += 1;
          continue;
        }
        if (!importedClientIds.has(String(item.clientId || ""))) {
          prunedMissingClient += 1;
          continue;
        }
        insertAccessStmt.run(String(item.token), JSON.stringify(item), Number(item.expiresAt || 0), String(item.clientId || ""), String(item.grantId || ""));
        importedAccess += 1;
      }
      for (const item of parsedState.refresh.values()) {
        if (!matchesImportedResource(item)) {
          prunedResourceMismatch += 1;
          continue;
        }
        if (!importedClientIds.has(String(item.clientId || ""))) {
          prunedMissingClient += 1;
          continue;
        }
        insertRefreshStmt.run(String(item.token), JSON.stringify(item), Number(item.expiresAt || 0), String(item.clientId || ""), String(item.grantId || ""));
        importedRefresh += 1;
      }
      for (const item of parsedState.usedRefresh.values()) {
        if (!matchesImportedResource(item)) {
          prunedResourceMismatch += 1;
          continue;
        }
        if (!importedClientIds.has(String(item.clientId || ""))) {
          prunedMissingClient += 1;
          continue;
        }
        insertUsedRefreshStmt.run(
          String(item.token),
          JSON.stringify(item),
          Number(item.expiresAt || 0),
          String(item.clientId || ""),
          String(item.grantId || ""),
          Number(item.replayUntil || 0),
        );
        importedUsedRefresh += 1;
      }
      return {
        imported: true,
        importedClients,
        importedAccess,
        importedRefresh,
        importedUsedRefresh,
        prunedResourceMismatch,
        prunedMissingClient,
        legacyClientsPath: legacyClients.exists ? clientsPath : null,
        legacyStatePath: legacyState.exists ? oauthStatePath : null,
      };
    });

    if (!bootstrapResult.imported) return bootstrapResult;

    auditLog("oauth21_legacy_state_bootstrapped", {
      storage_file: resolvedStorageFile,
      clients_file: bootstrapResult.legacyClientsPath || "",
      state_file: bootstrapResult.legacyStatePath || "",
      imported_clients: bootstrapResult.importedClients,
      imported_access_tokens: bootstrapResult.importedAccess,
      imported_refresh_tokens: bootstrapResult.importedRefresh,
      imported_used_refresh_tokens: bootstrapResult.importedUsedRefresh,
      pruned_resource_mismatch: bootstrapResult.prunedResourceMismatch,
      pruned_missing_client: bootstrapResult.prunedMissingClient,
    });

    try {
      const retiredAtMs = now();
      const retiredClientsPath = retireLegacyFile(bootstrapResult.legacyClientsPath, retiredAtMs);
      const retiredStatePath = retireLegacyFile(bootstrapResult.legacyStatePath, retiredAtMs);
      auditLog("oauth21_legacy_state_retired", {
        storage_file: resolvedStorageFile,
        retired_clients_file: retiredClientsPath || "",
        retired_state_file: retiredStatePath || "",
      });
    } catch (error) {
      auditLog("oauth21_legacy_state_retire_failed", {
        storage_file: resolvedStorageFile,
        error_message: error.message,
      });
    }

    return bootstrapResult;
  }

  function loadClients() {
    bootstrapFromLegacyIfEmpty();
    const rows = selectClientsStmt.all();
    const clientsList = rows.map((row) => JSON.parse(row.client_json));
    return {
      backend,
      exists: rows.length > 0,
      clientsList,
      clientCount: rows.length,
    };
  }

  function saveClients(clientsList = []) {
    bootstrapFromLegacyIfEmpty();
    return withTransaction(() => {
      const t = now();
      for (const client of Array.isArray(clientsList) ? clientsList : []) {
        if (!client?.client_id) continue;
        insertClientStmt.run(String(client.client_id), JSON.stringify(client), t);
      }
      const clientCount = Number(countClientsStmt.get().count || 0);
      return {
        backend,
        clientCount,
        mergeMode: "sqlite_upsert_by_client_id",
      };
    });
  }

  function readStateSnapshot(nowMs = now()) {
    const expiredAccess = Number(countExpiredAccessStmt.get(nowMs).count || 0);
    const expiredRefresh = Number(countExpiredRefreshStmt.get(nowMs).count || 0);
    const expiredUsedRefresh = Number(countExpiredUsedRefreshStmt.get(nowMs).count || 0);
    deleteExpiredAccessStmt.run(nowMs);
    deleteExpiredRefreshStmt.run(nowMs);
    deleteExpiredUsedRefreshStmt.run(nowMs);
    const access = new Map();
    const refresh = new Map();
    const usedRefresh = new Map();
    for (const row of selectAccessStmt.all()) {
      const item = JSON.parse(row.token_json);
      if (item?.token) access.set(String(item.token), item);
    }
    for (const row of selectRefreshStmt.all()) {
      const item = JSON.parse(row.token_json);
      if (item?.token) refresh.set(String(item.token), item);
    }
    for (const row of selectUsedRefreshStmt.all()) {
      const item = JSON.parse(row.token_json);
      if (item?.token && item?.grantId) usedRefresh.set(String(item.token), item);
    }
    return {
      exists: access.size > 0 || refresh.size > 0 || usedRefresh.size > 0,
      access,
      refresh,
      usedRefresh,
      expiredAccess,
      expiredRefresh,
      expiredUsedRefresh,
    };
  }

  function buildMergedState({
    nowMs = now(),
    accessTokens = new Map(),
    refreshTokens = new Map(),
    usedRefreshTokens = new Map(),
    deletedAccessTokens = new Set(),
    deletedRefreshTokens = new Set(),
    deletedUsedRefreshTokens = new Set(),
  } = {}) {
    const diskState = readStateSnapshot(nowMs);
    const mergedAccess = new Map(diskState.access);
    const mergedRefreshCandidates = new Map(diskState.refresh);
    const mergedUsedRefresh = new Map(diskState.usedRefresh);

    for (const token of deletedAccessTokens) mergedAccess.delete(token);
    for (const token of deletedRefreshTokens) mergedRefreshCandidates.delete(token);
    for (const token of deletedUsedRefreshTokens) mergedUsedRefresh.delete(token);

    for (const [token, item] of accessTokens) mergedAccess.set(token, item);
    for (const [token, item] of refreshTokens) mergedRefreshCandidates.set(token, item);
    for (const [token, item] of usedRefreshTokens) mergedUsedRefresh.set(token, item);

    for (const token of mergedUsedRefresh.keys()) mergedRefreshCandidates.delete(token);

    const refreshByGrant = new Map();
    const refreshWithoutGrant = [];
    for (const item of mergedRefreshCandidates.values()) {
      const grantKey = String(item?.grantId || "");
      if (!grantKey) {
        refreshWithoutGrant.push(item);
        continue;
      }
      refreshByGrant.set(grantKey, choosePreferredRefreshToken(refreshByGrant.get(grantKey), item));
    }

    const mergedRefresh = new Map();
    for (const item of refreshByGrant.values()) mergedRefresh.set(String(item.token), item);
    for (const item of refreshWithoutGrant) mergedRefresh.set(String(item.token), item);

    return {
      access: mergedAccess,
      refresh: mergedRefresh,
      usedRefresh: mergedUsedRefresh,
      expiredAccess: diskState.expiredAccess,
      expiredRefresh: diskState.expiredRefresh,
      expiredUsedRefresh: diskState.expiredUsedRefresh,
      existedOnDisk: diskState.exists,
    };
  }

  function loadOAuthState({ nowMs = now() } = {}) {
    bootstrapFromLegacyIfEmpty(nowMs);
    return withTransaction(() => {
      const snapshot = readStateSnapshot(nowMs);
      return {
        backend,
        ...snapshot,
      };
    });
  }

  function saveOAuthState({
    nowMs = now(),
    accessTokens = new Map(),
    refreshTokens = new Map(),
    usedRefreshTokens = new Map(),
    deletedAccessTokens = new Set(),
    deletedRefreshTokens = new Set(),
    deletedUsedRefreshTokens = new Set(),
  } = {}) {
    bootstrapFromLegacyIfEmpty(nowMs);
    return withTransaction(() => {
      const mergedState = buildMergedState({
        nowMs,
        accessTokens,
        refreshTokens,
        usedRefreshTokens,
        deletedAccessTokens,
        deletedRefreshTokens,
        deletedUsedRefreshTokens,
      });

      clearAccessStmt.run();
      clearRefreshStmt.run();
      clearUsedRefreshStmt.run();

      for (const item of mergedState.access.values()) {
        insertAccessStmt.run(String(item.token), JSON.stringify(item), Number(item.expiresAt || 0), String(item.clientId || ""), String(item.grantId || ""));
      }
      for (const item of mergedState.refresh.values()) {
        insertRefreshStmt.run(String(item.token), JSON.stringify(item), Number(item.expiresAt || 0), String(item.clientId || ""), String(item.grantId || ""));
      }
      for (const item of mergedState.usedRefresh.values()) {
        insertUsedRefreshStmt.run(
          String(item.token),
          JSON.stringify(item),
          Number(item.expiresAt || 0),
          String(item.clientId || ""),
          String(item.grantId || ""),
          Number(item.replayUntil || 0),
        );
      }

      return {
        backend,
        accessCount: mergedState.access.size,
        refreshCount: mergedState.refresh.size,
        usedRefreshCount: mergedState.usedRefresh.size,
        expiredAccess: mergedState.expiredAccess,
        expiredRefresh: mergedState.expiredRefresh,
        expiredUsedRefresh: mergedState.expiredUsedRefresh,
        mergeMode: "sqlite_transactional_union_with_grant_resolution",
      };
    });
  }

  return {
    backend,
    storageFile: resolvedStorageFile,
    clientsPath: resolvedStorageFile,
    oauthStatePath: resolvedStorageFile,
    loadClients,
    saveClients,
    loadOAuthState,
    saveOAuthState,
  };
}

module.exports = {
  createOAuth21PersistenceStore,
};
