"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  clientIp,
  htmlResponse,
  jsonResponse,
  randomToken,
  readBody,
  redirectResponse,
  sha256Base64Url,
  trimSlash,
} = require("./oauth21_utils");

const ACCESS_TTL_SECONDS = 3600;
const REFRESH_TTL_SECONDS = 30 * 86400;
const CODE_TTL_MS = 10 * 60 * 1000;
const PENDING_TTL_MS = 10 * 60 * 1000;
const DEFAULT_LOGIN_LIMIT = 10;
const DEFAULT_LOGIN_WINDOW_MS = 60 * 1000;

function buildLoginPage(pid) {
  const safePid = String(pid || "").replace(/"/g, "&quot;");
  return `<!doctype html><html><body><h3>mcp-tests OAuth 2.1 operator authorization</h3><form method="post" action="/oauth/operator-login"><input type="hidden" name="pid" value="${safePid}"><label>Operator secret <input name="password" type="password" autofocus></label><button type="submit">Authorize</button></form></body></html>`;
}

function createOAuth21AuthorizationServer({ issuer, operatorSecret, clientsFile, now = () => Date.now(), loginLimit = DEFAULT_LOGIN_LIMIT, loginWindowMs = DEFAULT_LOGIN_WINDOW_MS } = {}) {
  issuer = trimSlash(issuer);
  operatorSecret = String(operatorSecret || "");
  if (!issuer) throw new Error("oauth21_issuer_required");
  if (operatorSecret.length < 8) throw new Error("oauth21_operator_secret_required");

  // DCR client registry is persisted to disk (outside C:\Work) so a process
  // restart does NOT invalidate connectors' previously-registered client_id
  // (which would surface as invalid_client and force a full re-auth). Only the
  // long-lived client registrations are persisted; pending/codes/tokens stay
  // in-RAM ephemeral session artifacts by design.
  const clientsPath = clientsFile || process.env.MCP_TEST_OAUTH_CLIENTS_FILE
    || path.join(os.homedir(), ".romion", "tests_oauth_clients.json");

  const clients = new Map();
  const pending = new Map();
  const codes = new Map();
  const accessTokens = new Map();
  const refreshTokens = new Map();
  const loginAttempts = new Map();

  function persistClients() {
    try {
      fs.mkdirSync(path.dirname(clientsPath), { recursive: true });
      fs.writeFileSync(clientsPath, JSON.stringify([...clients.values()], null, 2), "utf8");
    } catch (e) {
      console.error(`[oauth21] could not persist DCR clients: ${e.message}`);
    }
  }

  function loadClients() {
    try {
      if (!fs.existsSync(clientsPath)) return;
      const arr = JSON.parse(fs.readFileSync(clientsPath, "utf8") || "[]");
      if (Array.isArray(arr)) {
        for (const c of arr) if (c && c.client_id) clients.set(String(c.client_id), c);
      }
    } catch (e) {
      console.error(`[oauth21] could not load DCR clients: ${e.message}`);
    }
  }

  loadClients();

  function cleanup() {
    const t = now();
    for (const [pid, item] of pending) if (item.expiresAt <= t) pending.delete(pid);
    for (const [code, item] of codes) if (item.expiresAt <= t || item.used) codes.delete(code);
    for (const [token, item] of accessTokens) if (item.expiresAt <= t) accessTokens.delete(token);
    for (const [token, item] of refreshTokens) if (item.expiresAt <= t) refreshTokens.delete(token);
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
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["mcp:tools"],
    };
  }

  function registerClient(body = {}) {
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : [];
    if (redirectUris.length === 0) return { status: 400, body: { error: "invalid_client_metadata", error_description: "redirect_uris_required" } };
    const method = String(body.token_endpoint_auth_method || "none");
    if (method !== "none") return { status: 400, body: { error: "invalid_client_metadata", error_description: "only_public_clients_supported" } };
    const clientId = `mcp_tests_${randomToken(18)}`;
    const client = {
      client_id: clientId,
      client_id_issued_at: Math.floor(now() / 1000),
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "mcp:tools",
    };
    clients.set(clientId, client);
    persistClients();
    return { status: 201, body: client };
  }

  function authorize(query = {}) {
    cleanup();
    const client = clients.get(String(query.client_id || ""));
    if (!client) return { status: 400, body: { error: "invalid_client" } };
    const redirectUri = String(query.redirect_uri || "");
    if (!client.redirect_uris.includes(redirectUri)) return { status: 400, body: { error: "invalid_request", error_description: "redirect_uri_mismatch" } };
    if (String(query.response_type || "") !== "code") return { status: 400, body: { error: "unsupported_response_type" } };
    if (String(query.code_challenge_method || "") !== "S256") return { status: 400, body: { error: "invalid_request", error_description: "pkce_s256_required" } };
    if (!query.code_challenge) return { status: 400, body: { error: "invalid_request", error_description: "code_challenge_required" } };
    const pid = randomToken(24);
    pending.set(pid, {
      clientId: client.client_id,
      redirectUri,
      codeChallenge: String(query.code_challenge),
      state: query.state === undefined ? "" : String(query.state),
      scope: String(query.scope || "mcp:tools"),
      expiresAt: now() + PENDING_TTL_MS,
    });
    return { status: 302, location: `${issuer}/oauth/operator-login?pid=${encodeURIComponent(pid)}` };
  }

  function checkLoginThrottle(req) {
    const ip = clientIp(req);
    const t = now();
    const item = loginAttempts.get(ip) || { resetAt: t + loginWindowMs, count: 0 };
    if (item.resetAt <= t) { item.resetAt = t + loginWindowMs; item.count = 0; }
    item.count += 1;
    loginAttempts.set(ip, item);
    return item.count <= loginLimit;
  }

  function completeLogin({ pid, password, req }) {
    cleanup();
    if (!checkLoginThrottle(req)) return { status: 429, body: "Too many attempts" };
    const item = pending.get(String(pid || ""));
    if (!item) return { status: 400, body: "Invalid or expired authorization request" };
    const left = Buffer.from(String(password || ""));
    const right = Buffer.from(operatorSecret);
    const ok = left.length === right.length && crypto.timingSafeEqual(left, right);
    if (!ok) return { status: 401, body: "Unauthorized" };
    pending.delete(String(pid));
    const code = randomToken(32);
    codes.set(code, { ...item, code, expiresAt: now() + CODE_TTL_MS, used: false });
    const target = new URL(item.redirectUri);
    target.searchParams.set("code", code);
    if (item.state) target.searchParams.set("state", item.state);
    return { status: 302, location: target.toString() };
  }

  function issue(clientId, scope = "mcp:tools") {
    const accessToken = randomToken(32);
    const refreshToken = randomToken(32);
    const t = now();
    const scopes = String(scope || "mcp:tools").split(/\s+/).filter(Boolean);
    accessTokens.set(accessToken, { token: accessToken, clientId, scopes, subject: "operator", expiresAt: t + ACCESS_TTL_SECONDS * 1000 });
    refreshTokens.set(refreshToken, { token: refreshToken, clientId, scopes, subject: "operator", expiresAt: t + REFRESH_TTL_SECONDS * 1000 });
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
      if (sha256Base64Url(body.code_verifier || "") !== code.codeChallenge) return { status: 400, body: { error: "invalid_grant", error_description: "pkce_verification_failed" } };
      code.used = true;
      return { status: 200, body: issue(client.client_id, code.scope) };
    }
    if (grant === "refresh_token") {
      const client = clients.get(String(body.client_id || ""));
      const refresh = refreshTokens.get(String(body.refresh_token || ""));
      if (!client || !refresh || refresh.clientId !== client.client_id) return { status: 400, body: { error: "invalid_grant" } };
      refreshTokens.delete(refresh.token);
      return { status: 200, body: issue(client.client_id, refresh.scopes.join(" ")) };
    }
    return { status: 400, body: { error: "unsupported_grant_type" } };
  }

  function revoke(body = {}) {
    const value = String(body.token || "");
    accessTokens.delete(value);
    refreshTokens.delete(value);
    return { status: 200, body: {} };
  }

  function validateAccessToken(value) {
    cleanup();
    const item = accessTokens.get(String(value || ""));
    if (!item) return { ok: false, status: 401, error: "invalid_token", mode: "oauth21" };
    return { ok: true, status: 200, error: "", mode: "oauth21", subject: item.subject, scopes: item.scopes };
  }

  async function handleRoute({ req, res, url }) {
    if (url.pathname === "/.well-known/oauth-authorization-server") return jsonResponse(res, 200, metadata());
    if (url.pathname === "/register" && req.method === "POST") {
      const result = registerClient(await readBody(req));
      return jsonResponse(res, result.status, result.body);
    }
    if (url.pathname === "/authorize" && req.method === "GET") {
      const result = authorize(Object.fromEntries(url.searchParams));
      if (result.status === 302) return redirectResponse(res, result.location);
      return jsonResponse(res, result.status, result.body);
    }
    if (url.pathname === "/oauth/operator-login" && req.method === "GET") return htmlResponse(res, 200, buildLoginPage(url.searchParams.get("pid") || ""));
    if (url.pathname === "/oauth/operator-login" && req.method === "POST") {
      const body = await readBody(req);
      const result = completeLogin({ pid: body.pid, password: body.password, req });
      if (result.status === 302) return redirectResponse(res, result.location);
      return htmlResponse(res, result.status, result.body);
    }
    if (url.pathname === "/token" && req.method === "POST") {
      const result = token(await readBody(req));
      return jsonResponse(res, result.status, result.body);
    }
    if (url.pathname === "/revoke" && req.method === "POST") {
      const result = revoke(await readBody(req));
      return jsonResponse(res, result.status, result.body);
    }
    return false;
  }

  return { issuer, metadata, registerClient, authorize, completeLogin, token, revoke, validateAccessToken, handleRoute, status: () => ({ issuer, clients: clients.size, pending: pending.size, codes: codes.size, access_tokens: accessTokens.size }) };
}

module.exports = { createOAuth21AuthorizationServer, sha256Base64Url };
