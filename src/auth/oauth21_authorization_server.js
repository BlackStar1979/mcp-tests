"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  clientIp,
  htmlResponse,
  jsonResponse,
  parseSearchParams,
  randomToken,
  readBody,
  readFormBody,
  readJsonBody,
  redirectResponse,
  sha256Base64Url,
  trimSlash,
} = require("./oauth21_utils");
const { buildOAuth21PrunePreview } = require("./oauth21_prune_preview");

const ACCESS_TTL_SECONDS = 3600;
const REFRESH_TTL_SECONDS = 30 * 86400;
const REFRESH_REPLAY_GRACE_MS = 60 * 1000;
const CLIENT_PRUNE_RETENTION_MS = 14 * 86400 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;
const PENDING_TTL_MS = 10 * 60 * 1000;
const DEFAULT_LOGIN_LIMIT = 10;
const DEFAULT_LOGIN_WINDOW_MS = 60 * 1000;
const DEFAULT_STATE_LOCK_TIMEOUT_MS = 5000;
const DEFAULT_STATE_LOCK_STALE_MS = 30000;
const STATE_LOCK_RETRY_MS = 25;
const SUPPORTED_SCOPES = new Set(["mcp:tools"]);
const PKCE_RE = /^[A-Za-z0-9._~-]{43,128}$/;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildLoginPage(item, pid) {
  const safePid = escapeHtml(pid);
  const safeClientId = escapeHtml(item?.clientId || "");
  const safeRedirectUri = escapeHtml(item?.redirectUri || "");
  const safeScope = escapeHtml(item?.scope || "mcp:tools");
  return `<!doctype html><html><body><h3>mcp-tests OAuth 2.1 operator authorization</h3><p>Client ID: <code>${safeClientId}</code></p><p>Redirect URI: <code>${safeRedirectUri}</code></p><p>Requested scope: <code>${safeScope}</code></p><form method="post" action="/oauth/operator-login"><input type="hidden" name="pid" value="${safePid}"><input type="hidden" name="client_id" value="${safeClientId}"><input type="hidden" name="redirect_uri" value="${safeRedirectUri}"><input type="hidden" name="scope" value="${safeScope}"><label>Operator secret <input name="password" type="password" autofocus></label><button type="submit">Authorize</button></form></body></html>`;
}

function loginBindingMatches(item, form = {}) {
  return String(form.client_id || "") === String(item?.clientId || "")
    && String(form.redirect_uri || "") === String(item?.redirectUri || "")
    && String(form.scope || "mcp:tools") === String(item?.scope || "mcp:tools");
}

function isLoopbackHostname(hostname) {
  const value = String(hostname || "").trim().toLowerCase();
  return value === "localhost" || value === "127.0.0.1" || value === "[::1]";
}

function isLoopbackIpHostname(hostname) {
  const value = String(hostname || "").trim().toLowerCase();
  return value === "127.0.0.1" || value === "[::1]";
}

function validateRedirectUri(value) {
  const text = String(value || "").trim();
  if (!text) return { ok: false, reason: "redirect_uri_empty" };
  if (text.includes("*")) return { ok: false, reason: "redirect_uri_wildcard_forbidden" };

  let parsed;
  try {
    parsed = new URL(text);
  } catch (_) {
    return { ok: false, reason: "redirect_uri_invalid" };
  }

  const protocol = String(parsed.protocol || "").toLowerCase();
  if (protocol === "javascript:") return { ok: false, reason: "redirect_uri_javascript_forbidden" };
  if (protocol === "file:") return { ok: false, reason: "redirect_uri_file_forbidden" };
  if (parsed.hash) return { ok: false, reason: "redirect_uri_fragment_forbidden" };
  if (parsed.username || parsed.password) return { ok: false, reason: "redirect_uri_userinfo_forbidden" };

  if (protocol === "https:") {
    return { ok: true, value: parsed.toString() };
  }

  if (protocol === "http:" && isLoopbackHostname(parsed.hostname)) {
    return { ok: true, value: parsed.toString() };
  }

  return { ok: false, reason: "redirect_uri_scheme_not_allowed" };
}

function matchesResource(value, expectedResource) {
  return String(value || "").trim() === String(expectedResource || "").trim();
}

function canonicalizeResource(value, canonicalResource, aliases = []) {
  const resourceValue = String(value || "").trim();
  const canonicalValue = String(canonicalResource || "").trim();
  if (!resourceValue || !canonicalValue) return "";
  if (matchesResource(resourceValue, canonicalValue)) return canonicalValue;
  for (const alias of aliases) {
    if (matchesResource(resourceValue, alias)) return canonicalValue;
  }
  return "";
}

function matchesRegisteredRedirectUri(registeredValue, requestedValue) {
  const registeredText = String(registeredValue || "").trim();
  const requestedText = String(requestedValue || "").trim();
  if (!registeredText || !requestedText) return false;
  if (registeredText === requestedText) return true;

  let registered;
  let requested;
  try {
    registered = new URL(registeredText);
    requested = new URL(requestedText);
  } catch (_) {
    return false;
  }

  if (
    String(registered.protocol || "").toLowerCase() !== "http:"
    || String(requested.protocol || "").toLowerCase() !== "http:"
    || !isLoopbackIpHostname(registered.hostname)
    || !isLoopbackIpHostname(requested.hostname)
  ) {
    return false;
  }

  return registered.hostname === requested.hostname
    && registered.username === requested.username
    && registered.password === requested.password
    && registered.pathname === requested.pathname
    && registered.search === requested.search
    && registered.hash === requested.hash;
}

function normalizeScopeTokens(value, fallback = "mcp:tools") {
  const raw = String(value || fallback || "mcp:tools");
  return raw.split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

function hasOnlySupportedScopes(scopes = []) {
  return Array.isArray(scopes)
    && scopes.length > 0
    && scopes.every((scope) => SUPPORTED_SCOPES.has(String(scope || "").trim()));
}

function isValidPkceValue(value) {
  return PKCE_RE.test(String(value || ""));
}

function createOAuth21AuthorizationServer({ issuer, resource = "", operatorSecret, clientsFile, trustedProxyHeaders = false, now = () => Date.now(), loginLimit = DEFAULT_LOGIN_LIMIT, loginWindowMs = DEFAULT_LOGIN_WINDOW_MS } = {}) {
  issuer = trimSlash(issuer);
  resource = trimSlash(resource || `${issuer}/mcp`);
  operatorSecret = String(operatorSecret || "");
  if (!issuer) throw new Error("oauth21_issuer_required");
  if (!resource) throw new Error("oauth21_resource_required");
  if (operatorSecret.length < 8) throw new Error("oauth21_operator_secret_required");
  const resourceAliases = resource === issuer ? [] : [issuer];

  // DCR client registry and OAuth access/refresh state are persisted to disk
  // so a controlled process restart does not invalidate the connector client_id
  // or force a full operator re-authorization. Pending authorization requests
  // and one-time authorization codes remain in RAM by design.
  const clientsPath = clientsFile || process.env.MCP_TEST_OAUTH_CLIENTS_FILE
    || path.join(os.homedir(), ".romion", "tests_oauth_clients.json");
  const oauthStatePath = process.env.MCP_TEST_OAUTH_STATE_FILE
    || path.join(os.homedir(), ".romion", "tests_oauth_state.json");

  const clients = new Map();
  const pending = new Map();
  const codes = new Map();
  const accessTokens = new Map();
  const refreshTokens = new Map();
  const usedRefreshTokens = new Map();
  const activeRefreshTokensByGrant = new Map();
  const deletedAccessTokens = new Set();
  const deletedRefreshTokens = new Set();
  const deletedUsedRefreshTokens = new Set();
  const loginAttempts = new Map();
  let auditLog = null;
  const deferredAuditEvents = [];

  function setAccessTokenRecord(token, item) {
    const key = String(token || item?.token || "");
    if (!key || !item) return;
    deletedAccessTokens.delete(key);
    accessTokens.set(key, item);
  }

  function deleteAccessTokenRecord(token) {
    const key = String(token || "");
    if (!key) return false;
    const deleted = accessTokens.delete(key);
    if (deleted) deletedAccessTokens.add(key);
    return deleted;
  }

  function setRefreshTokenRecord(token, item) {
    const key = String(token || item?.token || "");
    if (!key || !item) return;
    deletedRefreshTokens.delete(key);
    refreshTokens.set(key, item);
    if (item.grantId) activeRefreshTokensByGrant.set(String(item.grantId), key);
  }

  function deleteRefreshTokenRecord(token) {
    const key = String(token || "");
    if (!key) return false;
    const item = refreshTokens.get(key);
    const deleted = refreshTokens.delete(key);
    if (deleted) {
      deletedRefreshTokens.add(key);
      if (item?.grantId && activeRefreshTokensByGrant.get(String(item.grantId)) === key) {
        activeRefreshTokensByGrant.delete(String(item.grantId));
      }
    }
    return deleted;
  }

  function setUsedRefreshTokenRecord(token, item) {
    const key = String(token || item?.token || "");
    if (!key || !item) return;
    deletedUsedRefreshTokens.delete(key);
    usedRefreshTokens.set(key, item);
  }

  function deleteUsedRefreshTokenRecord(token) {
    const key = String(token || "");
    if (!key) return false;
    const deleted = usedRefreshTokens.delete(key);
    if (deleted) deletedUsedRefreshTokens.add(key);
    return deleted;
  }

  function parseOAuthStateBody(body = {}, nowMs = now()) {
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

  function readOAuthStateFile(nowMs = now()) {
    if (!fs.existsSync(oauthStatePath)) {
      return {
        exists: false,
        access: new Map(),
        refresh: new Map(),
        usedRefresh: new Map(),
        expiredAccess: 0,
        expiredRefresh: 0,
        expiredUsedRefresh: 0,
      };
    }
    const raw = fs.readFileSync(oauthStatePath, "utf8") || "{}";
    const parsed = parseOAuthStateBody(JSON.parse(raw), nowMs);
    return { exists: true, ...parsed };
  }

  function readClientsFile() {
    if (!fs.existsSync(clientsPath)) return { exists: false, clientsList: [] };
    const raw = fs.readFileSync(clientsPath, "utf8") || "[]";
    const parsed = JSON.parse(raw);
    return { exists: true, clientsList: Array.isArray(parsed) ? parsed : [] };
  }

  function buildMergedClientsSnapshot(persisted = null) {
    const diskState = persisted || readClientsFile();
    const merged = new Map();
    for (const client of diskState.clientsList) {
      if (client && client.client_id) merged.set(String(client.client_id), client);
    }
    for (const client of clients.values()) {
      if (client && client.client_id) merged.set(String(client.client_id), client);
    }
    return { exists: diskState.exists, clientsList: [...merged.values()] };
  }

  function choosePreferredRefreshToken(currentItem, candidateItem) {
    if (!currentItem) return candidateItem;
    if (!candidateItem) return currentItem;
    const currentExpiry = Number(currentItem.expiresAt || 0);
    const candidateExpiry = Number(candidateItem.expiresAt || 0);
    if (candidateExpiry !== currentExpiry) return candidateExpiry > currentExpiry ? candidateItem : currentItem;
    return String(candidateItem.token || "") > String(currentItem.token || "") ? candidateItem : currentItem;
  }

  function buildMergedOAuthState(nowMs = now(), persisted = null) {
    const diskState = persisted || readOAuthStateFile(nowMs);
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

  function writeJsonFileAtomic(body, targetPath, onReplaceFallback) {
    const payload = JSON.stringify(body, null, 2);
    const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, payload, { encoding: "utf8", mode: 0o600 });
    try {
      fs.renameSync(tmpPath, targetPath);
    } catch (renameError) {
      try {
        fs.copyFileSync(tmpPath, targetPath);
        fs.rmSync(tmpPath, { force: true });
      } catch (fallbackError) {
        try { if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { force: true }); } catch (_) {}
        throw fallbackError;
      }
      if (typeof onReplaceFallback === "function") onReplaceFallback(renameError.message);
    }
  }

  function withFileLock(targetPath, onStaleLockRecovered, fn) {
    const lockPath = `${targetPath}.lock`;
    const startedAt = now();
    while (true) {
      try {
        fs.mkdirSync(lockPath);
        break;
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
        let lockAgeMs = 0;
        try {
          lockAgeMs = Math.max(0, now() - fs.statSync(lockPath).mtimeMs);
        } catch (_) {
          lockAgeMs = 0;
        }
        if (lockAgeMs >= DEFAULT_STATE_LOCK_STALE_MS) {
          try {
            fs.rmSync(lockPath, { recursive: true, force: true });
            if (typeof onStaleLockRecovered === "function") onStaleLockRecovered(lockAgeMs);
            continue;
          } catch (_) {}
        }
        if ((now() - startedAt) >= DEFAULT_STATE_LOCK_TIMEOUT_MS) {
          throw new Error("oauth21_state_lock_timeout");
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, STATE_LOCK_RETRY_MS);
      }
    }
    try {
      return fn();
    } finally {
      try { fs.rmSync(lockPath, { recursive: true, force: true }); } catch (_) {}
    }
  }

  function auditOAuth(name, data = {}) {
    const payload = { issuer, ...data };
    if (typeof auditLog === "function") {
      try { auditLog(name, payload); } catch (_) {}
      return;
    }
    deferredAuditEvents.push({ name, payload });
  }

  function setAuditLog(fn) {
    if (typeof fn !== "function") return;
    auditLog = fn;
    while (deferredAuditEvents.length) {
      const event = deferredAuditEvents.shift();
      try { auditLog(event.name, event.payload); } catch (_) {}
    }
  }

  function persistClients(options = {}) {
    const shouldThrow = options.throwOnError === true;
    try {
      fs.mkdirSync(path.dirname(clientsPath), { recursive: true });
      const mergedClients = withFileLock(
        clientsPath,
        (lockAgeMs) => auditOAuth("oauth21_clients_lock_stale_recovered", { clients_file: clientsPath, lock_age_ms: lockAgeMs }),
        () => {
          const snapshot = buildMergedClientsSnapshot();
          writeJsonFileAtomic(
            snapshot.clientsList,
            clientsPath,
            (errorMessage) => auditOAuth("oauth21_clients_atomic_replace_fallback", { clients_file: clientsPath, error_message: errorMessage }),
          );
          return snapshot;
        },
      );
      auditOAuth("oauth21_clients_saved", {
        clients_file: clientsPath,
        client_count: mergedClients.clientsList.length,
        merge_mode: "locked_union_by_client_id",
      });
      return true;
    } catch (e) {
      auditOAuth("oauth21_clients_save_failed", { clients_file: clientsPath, error_message: e.message });
      console.error(`[oauth21] could not persist DCR clients: ${e.message}`);
      if (shouldThrow) throw e;
      return false;
    }
  }

  function loadClients() {
    try {
      const state = readClientsFile();
      if (!state.exists) {
        auditOAuth("oauth21_clients_missing", { clients_file: clientsPath });
        return;
      }
      for (const c of state.clientsList) if (c && c.client_id) clients.set(String(c.client_id), c);
      auditOAuth("oauth21_clients_loaded", { clients_file: clientsPath, client_count: clients.size });
    } catch (e) {
      auditOAuth("oauth21_clients_load_failed", { clients_file: clientsPath, error_message: e.message });
      console.error(`[oauth21] could not load DCR clients: ${e.message}`);
    }
  }

  function saveOAuthState(options = {}) {
    const shouldThrow = options.throwOnError === true;
    try {
      fs.mkdirSync(path.dirname(oauthStatePath), { recursive: true });
      const mergedState = withFileLock(
        oauthStatePath,
        (lockAgeMs) => auditOAuth("oauth21_state_lock_stale_recovered", { state_file: oauthStatePath, lock_age_ms: lockAgeMs }),
        () => {
          const snapshot = buildMergedOAuthState(now());
          const body = {
            access: [...snapshot.access.values()],
            refresh: [...snapshot.refresh.values()],
            used_refresh: [...snapshot.usedRefresh.values()],
          };
          writeJsonFileAtomic(
            body,
            oauthStatePath,
            (errorMessage) => auditOAuth("oauth21_state_atomic_replace_fallback", { state_file: oauthStatePath, error_message: errorMessage }),
          );
          return { snapshot, body };
        },
      );
      const body = mergedState.body;
      deletedAccessTokens.clear();
      deletedRefreshTokens.clear();
      deletedUsedRefreshTokens.clear();
      auditOAuth("oauth21_state_saved", {
        state_file: oauthStatePath,
        access_count: body.access.length,
        refresh_count: body.refresh.length,
        used_refresh_count: body.used_refresh.length,
        merge_mode: "locked_union_with_grant_resolution",
      });
      return true;
    } catch (e) {
      auditOAuth("oauth21_state_save_failed", { state_file: oauthStatePath, error_message: e.message });
      console.error(`[oauth21] could not save oauth state: ${e.message}`);
      if (shouldThrow) throw e;
      return false;
    }
  }

  function loadOAuthState() {
    try {
      const body = readOAuthStateFile(now());
      if (!body.exists) {
        auditOAuth("oauth21_state_missing", { state_file: oauthStatePath });
        return;
      }
      for (const item of body.access.values()) setAccessTokenRecord(item.token, item);
      for (const item of body.refresh.values()) setRefreshTokenRecord(item.token, item);
      for (const item of body.usedRefresh.values()) setUsedRefreshTokenRecord(item.token, item);
      auditOAuth("oauth21_state_loaded", {
        state_file: oauthStatePath,
        access_count: accessTokens.size,
        refresh_count: refreshTokens.size,
        used_refresh_count: usedRefreshTokens.size,
        expired_access_count: body.expiredAccess,
        expired_refresh_count: body.expiredRefresh,
        expired_used_refresh_count: body.expiredUsedRefresh,
      });
    } catch (e) {
      auditOAuth("oauth21_state_load_failed", { state_file: oauthStatePath, error_message: e.message });
      console.error(`[oauth21] could not load oauth state: ${e.message}`);
    }
  }

  loadClients();
  loadOAuthState();

  function cleanup() {
    const t = now();
    let oauthStateChanged = false;
    for (const [pid, item] of pending) if (item.expiresAt <= t) pending.delete(pid);
    for (const [code, item] of codes) if (item.expiresAt <= t || item.used) codes.delete(code);
    for (const [key, item] of accessTokens) if (item.expiresAt <= t) { deleteAccessTokenRecord(key); oauthStateChanged = true; }
    for (const [key, item] of refreshTokens) if (item.expiresAt <= t) {
      deleteRefreshTokenRecord(key);
      oauthStateChanged = true;
    }
    for (const [key, item] of usedRefreshTokens) if (item.expiresAt <= t) { deleteUsedRefreshTokenRecord(key); oauthStateChanged = true; }
    if (oauthStateChanged) saveOAuthState();
  }

  function metadata() {
    return {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      registration_endpoint: `${issuer}/register`,
      revocation_endpoint: `${issuer}/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      revocation_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["mcp:tools"],
    };
  }

  function registerClient(body = {}) {
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map((item) => validateRedirectUri(item)) : [];
    if (redirectUris.length === 0) return { status: 400, body: { error: "invalid_client_metadata", error_description: "redirect_uris_required" } };
    const invalidRedirectUri = redirectUris.find((item) => item.ok !== true);
    if (invalidRedirectUri) {
      return { status: 400, body: { error: "invalid_client_metadata", error_description: invalidRedirectUri.reason || "redirect_uri_invalid" } };
    }
    const method = String(body.token_endpoint_auth_method || "none");
    if (method !== "none") return { status: 400, body: { error: "invalid_client_metadata", error_description: "only_public_clients_supported" } };
    const clientId = `mcp_tests_${randomToken(18)}`;
    const client = {
      client_id: clientId,
      client_id_issued_at: Math.floor(now() / 1000),
      redirect_uris: redirectUris.map((item) => item.value),
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "mcp:tools",
    };
    clients.set(clientId, client);
    try {
      persistClients({ throwOnError: true });
    } catch (error) {
      clients.delete(clientId);
      auditOAuth("oauth21_client_registration_failed", { client_id: clientId, reason: "client_persistence_failed", error_message: error.message });
      return { status: 500, body: { error: "server_error", error_description: "client_persistence_failed" } };
    }
    return { status: 201, body: client };
  }

  function authorize(query = {}) {
    cleanup();
    const client = clients.get(String(query.client_id || ""));
    if (!client) return { status: 400, body: { error: "invalid_client" } };
    const redirectUri = String(query.redirect_uri || "");
    const requestedResource = canonicalizeResource(query.resource, resource, resourceAliases);
    const state = String(query.state || "");
    const scopes = normalizeScopeTokens(query.scope || "mcp:tools");
    if (!client.redirect_uris.some((item) => matchesRegisteredRedirectUri(item, redirectUri))) return { status: 400, body: { error: "invalid_request", error_description: "redirect_uri_mismatch" } };
    if (String(query.response_type || "") !== "code") return { status: 400, body: { error: "unsupported_response_type" } };
    if (String(query.code_challenge_method || "") !== "S256") return { status: 400, body: { error: "invalid_request", error_description: "pkce_s256_required" } };
    if (!query.code_challenge) return { status: 400, body: { error: "invalid_request", error_description: "code_challenge_required" } };
    if (!isValidPkceValue(query.code_challenge)) return { status: 400, body: { error: "invalid_request", error_description: "code_challenge_invalid" } };
    if (!state) return { status: 400, body: { error: "invalid_request", error_description: "state_required" } };
    if (!String(query.resource || "").trim()) {
      auditOAuth("oauth21_authorize_rejected", { reason: "resource_required", client_id: client.client_id });
      return { status: 400, body: { error: "invalid_target", error_description: "resource_required" } };
    }
    if (!requestedResource) {
      auditOAuth("oauth21_authorize_rejected", { reason: "resource_mismatch", client_id: client.client_id });
      return { status: 400, body: { error: "invalid_target", error_description: "resource_mismatch" } };
    }
    if (!hasOnlySupportedScopes(scopes)) return { status: 400, body: { error: "invalid_scope", error_description: "unsupported_scope" } };
    const pid = randomToken(24);
    pending.set(pid, {
      clientId: client.client_id,
      redirectUri,
      resource: requestedResource,
      codeChallenge: String(query.code_challenge),
      state,
      scope: scopes.join(" "),
      expiresAt: now() + PENDING_TTL_MS,
    });
    return { status: 302, location: `${issuer}/oauth/operator-login?pid=${encodeURIComponent(pid)}` };
  }

  function checkLoginThrottle(req) {
    const ip = clientIp(req, { trustProxyHeaders: trustedProxyHeaders === true });
    const t = now();
    const item = loginAttempts.get(ip) || { resetAt: t + loginWindowMs, count: 0 };
    if (item.resetAt <= t) { item.resetAt = t + loginWindowMs; item.count = 0; }
    item.count += 1;
    loginAttempts.set(ip, item);
    return item.count <= loginLimit;
  }

  function completeLogin({ pid, password, req, clientId, redirectUri, scope }) {
    cleanup();
    if (!checkLoginThrottle(req)) { auditOAuth("oauth21_operator_login_rejected", { reason: "login_throttled" }); return { status: 429, body: "Too many attempts" }; }
    const item = pending.get(String(pid || ""));
    if (!item) return { status: 400, body: "Invalid or expired authorization request" };
    if (!hasOnlySupportedScopes(normalizeScopeTokens(item.scope))) {
      auditOAuth("oauth21_operator_login_rejected", { reason: "unsupported_scope", client_id: item.clientId, scope: item.scope || "" });
      pending.delete(String(pid || ""));
      return { status: 400, body: "Unsupported scope" };
    }
    if (!loginBindingMatches(item, { client_id: clientId, redirect_uri: redirectUri, scope })) {
      auditOAuth("oauth21_operator_login_rejected", { reason: "binding_mismatch", client_id: item.clientId });
      return { status: 400, body: "Authorization request binding mismatch" };
    }
    const left = Buffer.from(String(password || ""));
    const right = Buffer.from(operatorSecret);
    const ok = left.length === right.length && crypto.timingSafeEqual(left, right);
    if (!ok) { auditOAuth("oauth21_operator_login_rejected", { reason: "bad_operator_secret" }); return { status: 401, body: "Unauthorized" }; }
    pending.delete(String(pid));
    auditOAuth("oauth21_operator_login_accepted", { client_id: item.clientId, scope: item.scope });
    const code = randomToken(32);
    codes.set(code, { ...item, code, expiresAt: now() + CODE_TTL_MS, used: false });
    const target = new URL(item.redirectUri);
    target.searchParams.set("code", code);
    if (item.state) target.searchParams.set("state", item.state);
    target.searchParams.set("iss", issuer);
    return { status: 302, location: target.toString() };
  }

  function issue(clientId, scope = "mcp:tools", tokenResource = resource, grantId = randomToken(16), options = {}) {
    const accessToken = randomToken(32);
    const refreshToken = randomToken(32);
    const t = now();
    const scopes = normalizeScopeTokens(scope || "mcp:tools");
    if (!hasOnlySupportedScopes(scopes)) return null;
    setAccessTokenRecord(accessToken, { token: accessToken, clientId, scopes, subject: "operator", resource: tokenResource, grantId, expiresAt: t + ACCESS_TTL_SECONDS * 1000 });
    setRefreshTokenRecord(refreshToken, { token: refreshToken, clientId, scopes, subject: "operator", resource: tokenResource, grantId, expiresAt: t + REFRESH_TTL_SECONDS * 1000 });
    try {
      if (options.persist !== false) saveOAuthState({ throwOnError: true });
    } catch (error) {
      deleteAccessTokenRecord(accessToken);
      deleteRefreshTokenRecord(refreshToken);
      auditOAuth("oauth21_issue_failed", { client_id: clientId, reason: "state_persistence_failed", error_message: error.message });
      return { error: "server_error", error_description: "state_persistence_failed" };
    }
    return { access_token: accessToken, token_type: "Bearer", expires_in: ACCESS_TTL_SECONDS, refresh_token: refreshToken, scope: scopes.join(" ") };
  }

  function token(body = {}) {
    cleanup();
    const grant = String(body.grant_type || "");
    if (grant === "authorization_code") {
      const client = clients.get(String(body.client_id || ""));
      const code = codes.get(String(body.code || ""));
      if (!client || !code || code.used || code.clientId !== client.client_id) return { status: 400, body: { error: "invalid_grant" } };
      if (String(body.redirect_uri || "") !== code.redirectUri) return { status: 400, body: { error: "invalid_grant", error_description: "redirect_uri_mismatch" } };
      const requestedResource = canonicalizeResource(body.resource, resource, resourceAliases);
      if (!body.resource) {
        auditOAuth("oauth21_token_rejected", { reason: "resource_required", grant_type: "authorization_code", client_id: client.client_id });
        return { status: 400, body: { error: "invalid_target", error_description: "resource_required" } };
      }
      if (!requestedResource || !matchesResource(requestedResource, code.resource)) {
        auditOAuth("oauth21_token_rejected", { reason: "resource_mismatch", grant_type: "authorization_code", client_id: client.client_id });
        return { status: 400, body: { error: "invalid_target", error_description: "resource_mismatch" } };
      }
      if (!isValidPkceValue(body.code_verifier)) return { status: 400, body: { error: "invalid_grant", error_description: "code_verifier_invalid" } };
      if (sha256Base64Url(body.code_verifier || "") !== code.codeChallenge) return { status: 400, body: { error: "invalid_grant", error_description: "pkce_verification_failed" } };
      code.used = true;
      const issued = issue(client.client_id, code.scope, code.resource);
      if (issued?.error) return { status: 500, body: issued };
      if (!issued) return { status: 400, body: { error: "invalid_scope", error_description: "unsupported_scope" } };
      return { status: 200, body: issued };
    }
    if (grant === "refresh_token") {
      const client = clients.get(String(body.client_id || ""));
      const refresh = refreshTokens.get(String(body.refresh_token || ""));
      if (!client || !refresh || refresh.clientId !== client.client_id) {
        const replay = client ? usedRefreshTokens.get(String(body.refresh_token || "")) : null;
        if (client && replay && replay.clientId === client.client_id) {
          const requestedReplayResource = canonicalizeResource(body.resource, resource, resourceAliases);
          const replayWindowOpen = Number(replay.replayUntil || 0) >= now();
          const replayResourceOk = requestedReplayResource && matchesResource(requestedReplayResource, replay.resource);
          if (replayWindowOpen && replayResourceOk && replay.issuedResponse) {
            auditOAuth("oauth21_refresh_token_replayed", {
              client_id: client.client_id,
              grant_id: String(replay.grantId || ""),
              replay_window_ms_remaining: Math.max(0, Number(replay.replayUntil || 0) - now()),
            });
            return { status: 200, body: replay.issuedResponse };
          }
          const active = activeRefreshTokensByGrant.get(String(replay.grantId || ""));
          if (active) {
            deleteRefreshTokenRecord(active);
            saveOAuthState();
          }
          auditOAuth("oauth21_refresh_token_rejected", {
            reason: "refresh_token_reuse_detected",
            client_id: client.client_id,
            active_refresh_revoked: Boolean(active),
          });
        } else {
          auditOAuth("oauth21_refresh_token_rejected", { reason: !client ? "unknown_client" : (!refresh ? "unknown_refresh_token" : "client_mismatch") });
        }
        return { status: 400, body: { error: "invalid_grant" } };
      }
      const resourceInput = String(body.resource || refresh.resource || "").trim();
      const requestedResource = canonicalizeResource(resourceInput, resource, resourceAliases);
      if (!resourceInput) {
        auditOAuth("oauth21_token_rejected", { reason: "resource_required", grant_type: "refresh_token", client_id: client.client_id });
        return { status: 400, body: { error: "invalid_target", error_description: "resource_required" } };
      }
      if (!requestedResource || !matchesResource(requestedResource, refresh.resource)) {
        auditOAuth("oauth21_token_rejected", { reason: "resource_mismatch", grant_type: "refresh_token", client_id: client.client_id });
        return { status: 400, body: { error: "invalid_target", error_description: "resource_mismatch" } };
      }
      deleteRefreshTokenRecord(refresh.token);
      const usedRefreshRecord = {
        token: String(refresh.token),
        clientId: refresh.clientId,
        resource: refresh.resource,
        grantId: String(refresh.grantId || ""),
        expiresAt: refresh.expiresAt,
      };
      setUsedRefreshTokenRecord(String(refresh.token), usedRefreshRecord);
      auditOAuth("oauth21_refresh_token_accepted", { client_id: client.client_id, scope_count: refresh.scopes.length });
      const issued = issue(client.client_id, refresh.scopes.join(" "), refresh.resource, refresh.grantId || randomToken(16), { persist: false });
      if (issued?.error) {
        deleteUsedRefreshTokenRecord(String(refresh.token));
        setRefreshTokenRecord(refresh.token, refresh);
        return { status: 500, body: issued };
      }
      if (!issued) return { status: 400, body: { error: "invalid_scope", error_description: "unsupported_scope" } };
      setUsedRefreshTokenRecord(String(refresh.token), {
        ...usedRefreshRecord,
        replayUntil: now() + REFRESH_REPLAY_GRACE_MS,
        issuedResponse: issued,
      });
      try {
        saveOAuthState({ throwOnError: true });
      } catch (error) {
        deleteAccessTokenRecord(String(issued.access_token || ""));
        deleteRefreshTokenRecord(String(issued.refresh_token || ""));
        deleteUsedRefreshTokenRecord(String(refresh.token));
        setRefreshTokenRecord(refresh.token, refresh);
        auditOAuth("oauth21_refresh_token_rejected", {
          reason: "state_persistence_failed",
          client_id: client.client_id,
          error_message: error.message,
        });
        return { status: 500, body: { error: "server_error", error_description: "state_persistence_failed" } };
      }
      return { status: 200, body: issued };
    }
    return { status: 400, body: { error: "unsupported_grant_type" } };
  }

  function revokeGrant(grantId) {
    const grantKey = String(grantId || "");
    if (!grantKey) return false;
    let changed = false;
    for (const [key, item] of accessTokens) {
      if (String(item?.grantId || "") === grantKey) {
        deleteAccessTokenRecord(key);
        changed = true;
      }
    }
    for (const [key, item] of refreshTokens) {
      if (String(item?.grantId || "") === grantKey) {
        deleteRefreshTokenRecord(key);
        changed = true;
      }
    }
    for (const [key, item] of usedRefreshTokens) {
      if (String(item?.grantId || "") === grantKey) {
        deleteUsedRefreshTokenRecord(key);
        changed = true;
      }
    }
    activeRefreshTokensByGrant.delete(grantKey);
    return changed;
  }

  function snapshotGrantRecords(grantId) {
    const grantKey = String(grantId || "");
    return {
      grantId: grantKey,
      access: [...accessTokens.values()].filter((item) => String(item?.grantId || "") === grantKey),
      refresh: [...refreshTokens.values()].filter((item) => String(item?.grantId || "") === grantKey),
      usedRefresh: [...usedRefreshTokens.values()].filter((item) => String(item?.grantId || "") === grantKey),
    };
  }

  function restoreGrantRecords(snapshot = {}) {
    const grantKey = String(snapshot.grantId || "");
    if (!grantKey) return;
    revokeGrant(grantKey);
    for (const item of Array.isArray(snapshot.access) ? snapshot.access : []) {
      if (item?.token) setAccessTokenRecord(item.token, item);
    }
    for (const item of Array.isArray(snapshot.refresh) ? snapshot.refresh : []) {
      if (item?.token) setRefreshTokenRecord(item.token, item);
    }
    for (const item of Array.isArray(snapshot.usedRefresh) ? snapshot.usedRefresh : []) {
      if (item?.token) setUsedRefreshTokenRecord(item.token, item);
    }
  }

  function revoke(body = {}) {
    const value = String(body.token || "");
    const clientId = String(body.client_id || "");
    const client = clients.get(clientId);
    if (!client) return { status: 400, body: { error: "invalid_client" } };
    const access = accessTokens.get(value);
    const refresh = refreshTokens.get(value);
    const usedRefresh = usedRefreshTokens.get(value);
    const item = access || refresh || usedRefresh;
    if (!item || item.clientId !== client.client_id) return { status: 200, body: {} };
    let changed = false;
    let rollback = () => {};
    if (item.grantId) {
      const snapshot = snapshotGrantRecords(item.grantId);
      rollback = () => restoreGrantRecords(snapshot);
      changed = revokeGrant(item.grantId);
    } else if (access) {
      rollback = () => setAccessTokenRecord(access.token, access);
      changed = deleteAccessTokenRecord(value);
    } else if (refresh) {
      rollback = () => setRefreshTokenRecord(refresh.token, refresh);
      changed = deleteRefreshTokenRecord(value);
    } else if (usedRefresh) {
      rollback = () => setUsedRefreshTokenRecord(usedRefresh.token, usedRefresh);
      changed = deleteUsedRefreshTokenRecord(value);
    }
    if (changed) {
      try {
        saveOAuthState({ throwOnError: true });
      } catch (error) {
        rollback();
        auditOAuth("oauth21_revoke_failed", { client_id: client.client_id, reason: "state_persistence_failed", error_message: error.message });
        return { status: 500, body: { error: "server_error", error_description: "state_persistence_failed" } };
      }
    }
    return { status: 200, body: {} };
  }

  function validateAccessToken(value, options = {}) {
    cleanup();
    const item = accessTokens.get(String(value || ""));
    if (!item) {
      auditOAuth("oauth21_access_token_rejected", { reason: "unknown_or_expired_access_token", access_count: accessTokens.size, refresh_count: refreshTokens.size });
      return { ok: false, status: 401, error: "invalid_token", mode: "oauth21" };
    }
    if (!hasOnlySupportedScopes(item.scopes)) {
      auditOAuth("oauth21_access_token_rejected", { reason: "unsupported_scope", scopes: item.scopes });
      return { ok: false, status: 401, error: "invalid_token", mode: "oauth21" };
    }
    const expectedResource = canonicalizeResource(options.resource || options.audience || resource, resource, resourceAliases);
    if (!expectedResource || !matchesResource(item.resource, expectedResource)) {
      auditOAuth("oauth21_access_token_rejected", { reason: "resource_mismatch", expected_resource: expectedResource, token_resource: item.resource || "" });
      return { ok: false, status: 401, error: "invalid_token", mode: "oauth21" };
    }
    auditOAuth("oauth21_access_token_accepted", { subject: item.subject, scope_count: item.scopes.length, access_count: accessTokens.size, refresh_count: refreshTokens.size });
    return { ok: true, status: 200, error: "", mode: "oauth21", subject: item.subject, clientId: item.clientId, scopes: item.scopes };
  }

  async function handleRoute({ req, res, url }) {
    if (url.pathname === "/.well-known/oauth-authorization-server") return jsonResponse(res, 200, metadata());
    if (url.pathname === "/register" && req.method === "POST") {
      const result = registerClient(await readJsonBody(req));
      return jsonResponse(res, result.status, result.body);
    }
    if (url.pathname === "/authorize" && req.method === "GET") {
      const result = authorize(parseSearchParams(url.searchParams));
      if (result.status === 302) return redirectResponse(res, result.location);
      return jsonResponse(res, result.status, result.body);
    }
    if (url.pathname === "/oauth/operator-login" && req.method === "GET") {
      cleanup();
      const pid = url.searchParams.get("pid") || "";
      const item = pending.get(String(pid || ""));
      if (!item) return htmlResponse(res, 400, "Invalid or expired authorization request");
      return htmlResponse(res, 200, buildLoginPage(item, pid), {
        "content-security-policy": "frame-ancestors 'none'",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
      });
    }
    if (url.pathname === "/oauth/operator-login" && req.method === "POST") {
      const body = await readFormBody(req);
      const result = completeLogin({
        pid: body.pid,
        password: body.password,
        req,
        clientId: body.client_id,
        redirectUri: body.redirect_uri,
        scope: body.scope,
      });
      if (result.status === 302) return redirectResponse(res, result.location);
      return htmlResponse(res, result.status, result.body);
    }
    if (url.pathname === "/token" && req.method === "POST") {
      const result = token(await readFormBody(req));
      return jsonResponse(res, result.status, result.body, { pragma: "no-cache" });
    }
    if (url.pathname === "/revoke" && req.method === "POST") {
      const result = revoke(await readFormBody(req));
      return jsonResponse(res, result.status, result.body);
    }
    return false;
  }

  function status() {
    const referencedClientIds = new Set();
    for (const item of accessTokens.values()) if (item?.clientId) referencedClientIds.add(String(item.clientId));
    for (const item of refreshTokens.values()) if (item?.clientId) referencedClientIds.add(String(item.clientId));
    for (const item of usedRefreshTokens.values()) if (item?.clientId) referencedClientIds.add(String(item.clientId));
    for (const item of pending.values()) if (item?.clientId) referencedClientIds.add(String(item.clientId));
    for (const item of codes.values()) if (item?.clientId) referencedClientIds.add(String(item.clientId));

    let orphanRefreshTokens = 0;
    let orphanUsedRefreshTokens = 0;
    let orphanAccessTokens = 0;
    let activeGrantCount = 0;
    const seenGrantIds = new Set();

    for (const item of accessTokens.values()) {
      if (!clients.has(String(item?.clientId || ""))) orphanAccessTokens += 1;
      if (item?.grantId) seenGrantIds.add(String(item.grantId));
    }
    for (const item of refreshTokens.values()) {
      if (!clients.has(String(item?.clientId || ""))) orphanRefreshTokens += 1;
      if (item?.grantId) seenGrantIds.add(String(item.grantId));
    }
    for (const item of usedRefreshTokens.values()) {
      if (!clients.has(String(item?.clientId || ""))) orphanUsedRefreshTokens += 1;
      if (item?.grantId) seenGrantIds.add(String(item.grantId));
    }
    activeGrantCount = seenGrantIds.size;

    let deadClientCount = 0;
    for (const clientId of clients.keys()) {
      if (!referencedClientIds.has(String(clientId))) deadClientCount += 1;
    }

    let refreshReplayWindowOpenCount = 0;
    const nowMs = now();
    for (const item of usedRefreshTokens.values()) {
      if (Number(item?.replayUntil || 0) >= nowMs) refreshReplayWindowOpenCount += 1;
    }

    return {
      issuer,
      resource,
      clients: clients.size,
      pending: pending.size,
      codes: codes.size,
      access_tokens: accessTokens.size,
      refresh_tokens: refreshTokens.size,
      used_refresh_tokens: usedRefreshTokens.size,
      oauth_state_file: oauthStatePath,
      oauth_clients_file: clientsPath,
      active_grants: activeGrantCount,
      dead_clients: deadClientCount,
      orphan_access_tokens: orphanAccessTokens,
      orphan_refresh_tokens: orphanRefreshTokens,
      orphan_used_refresh_tokens: orphanUsedRefreshTokens,
      refresh_replay_window_open: refreshReplayWindowOpenCount,
      prune_preview: buildOAuth21PrunePreview({
        clients,
        accessTokens,
        refreshTokens,
        usedRefreshTokens,
        pending,
        codes,
        nowMs,
        deadClientMinAgeMs: CLIENT_PRUNE_RETENTION_MS,
        oauthStatePath,
        clientsPath,
      }),
    };
  }

  return { issuer, resource, metadata, registerClient, authorize, completeLogin, token, revoke, validateAccessToken, handleRoute, setAuditLog, status };
}

module.exports = { createOAuth21AuthorizationServer, matchesRegisteredRedirectUri, sha256Base64Url, validateRedirectUri };
