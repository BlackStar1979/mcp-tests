"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const { createJwksCacheFromFile } = require("./oauth_jwks_cache");
const { createFileIntrospectionClient } = require("./oauth_introspection");
const { verifyJwtTimeClaims, verifyRs256 } = require("./oauth_jwt_verify");

function b64urlDecode(value) {
  const text = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = text.length % 4 ? "=".repeat(4 - (text.length % 4)) : "";
  return Buffer.from(text + pad, "base64").toString("utf8");
}

function parseJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("jwt_must_have_three_parts");
  return {
    header: JSON.parse(b64urlDecode(parts[0])),
    payload: JSON.parse(b64urlDecode(parts[1])),
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: parts[2],
  };
}

function b64url(buffer) {
  return Buffer.from(buffer).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function extractAuthorizationBearerToken(req = {}) {
  const headers = req.headers || {};
  const header = headers.authorization || headers.Authorization || "";
  const value = Array.isArray(header) ? header[0] : String(header || "");
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function hasQueryToken(req = {}) {
  const rawUrl = String(req.originalUrl || req.url || "");
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl, "http://mcp-tests.local");
    return parsed.searchParams.has("token") || parsed.searchParams.has("access_token");
  } catch (_) {
    return false;
  }
}

function scopeSet(payload = {}) {
  const raw = payload.scope || payload.scp || "";
  if (Array.isArray(raw)) return new Set(raw.map(String));
  return new Set(String(raw || "").split(/\s+/).filter(Boolean));
}

function audienceMatches(payload, audience) {
  const aud = payload.aud;
  if (Array.isArray(aud)) return aud.includes(audience);
  return String(aud || "") === audience;
}

function verifyHs256({ signingInput, signature, secret }) {
  const expected = b64url(crypto.createHmac("sha256", secret).update(signingInput).digest());
  const left = Buffer.from(signature || "", "utf8");
  const right = Buffer.from(expected || "", "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createOAuthAuth(options = {}) {
  const issuer = String(options.issuer || process.env.MCP_TEST_OAUTH_ISSUER || "").trim();
  const audience = String(options.audience || process.env.MCP_TEST_OAUTH_AUDIENCE || options.publicBaseUrl || "").replace(/\/+$/, "");
  const jwksFile = String(options.jwksFile || process.env.MCP_TEST_OAUTH_JWKS_FILE || "").trim();
  const secretFile = String(options.hmacSecretFile || process.env.MCP_TEST_OAUTH_HS256_SECRET_FILE || "").trim();
  const introspectionFile = String(options.introspectionFile || process.env.MCP_TEST_OAUTH_INTROSPECTION_FILE || "").trim();
  if (!issuer) throw new Error("MCP_TEST_OAUTH_ISSUER is required when MCP_TEST_AUTH_MODE=oauth.");
  if (!audience) throw new Error("MCP_TEST_OAUTH_AUDIENCE or publicBaseUrl is required when MCP_TEST_AUTH_MODE=oauth.");
  let jwksCache = null;
  let secret = "";
  let introspectionClient = null;
  if (jwksFile) {
    jwksCache = createJwksCacheFromFile({ path: jwksFile });
  } else if (introspectionFile) {
    introspectionClient = createFileIntrospectionClient({ responseFile: introspectionFile, issuer, audience });
  } else {
    if (!secretFile) throw new Error("MCP_TEST_OAUTH_HS256_SECRET_FILE is required when MCP_TEST_OAUTH_JWKS_FILE is not configured.");
    secret = fs.readFileSync(secretFile, "utf8").trim();
    if (secret.length < 32) throw new Error("OAuth HS256 secret must be at least 32 characters.");
  }

  return {
    mode: "oauth",
    enabled: true,
    requiresAuth: true,
    issuer,
    audience,
    authenticate(req = {}) {
      if (hasQueryToken(req)) return { ok: false, status: 400, error: "query_token_forbidden", mode: "oauth" };
      const token = extractAuthorizationBearerToken(req);
      if (!token) return { ok: false, status: 401, error: "missing_bearer_token", mode: "oauth" };
      if (introspectionClient) {
        const result = introspectionClient.introspect(token);
        if (!result.ok) return { ok: false, status: result.status || 401, error: result.error, mode: "oauth" };
        return { ok: true, status: 200, error: "", mode: "oauth", subject: result.subject || "", scopes: result.scopes || [] };
      }
      let parsed;
      try { parsed = parseJwt(token); } catch (_) { return { ok: false, status: 401, error: "invalid_jwt", mode: "oauth" }; }
      if (jwksCache) {
        if (parsed.header.alg !== "RS256") return { ok: false, status: 401, error: "unsupported_jwt_alg", mode: "oauth" };
        if (!parsed.header.kid) return { ok: false, status: 401, error: "missing_jwt_kid", mode: "oauth" };
        const found = jwksCache.findKey(parsed.header.kid);
        if (!found.ok) return { ok: false, status: 401, error: found.reason, mode: "oauth" };
        if (!verifyRs256({ signingInput: parsed.signingInput, signature: parsed.signature, jwk: found.key })) return { ok: false, status: 401, error: "invalid_jwt_signature", mode: "oauth" };
      } else {
        if (parsed.header.alg !== "HS256") return { ok: false, status: 401, error: "unsupported_jwt_alg", mode: "oauth" };
        if (!verifyHs256({ signingInput: parsed.signingInput, signature: parsed.signature, secret })) return { ok: false, status: 401, error: "invalid_jwt_signature", mode: "oauth" };
      }
      const now = Math.floor(Date.now() / 1000);
      if (parsed.payload.iss !== issuer) return { ok: false, status: 401, error: "invalid_issuer", mode: "oauth" };
      if (!audienceMatches(parsed.payload, audience)) return { ok: false, status: 401, error: "invalid_audience", mode: "oauth" };
      const timeCheck = verifyJwtTimeClaims(parsed.payload, now);
      if (!timeCheck.ok) return { ok: false, status: 401, error: timeCheck.reason, mode: "oauth" };
      const scopes = scopeSet(parsed.payload);
      if (!(scopes.has("mcp:tools") || scopes.has("mcp:public") || scopes.has("mcp:operator"))) return { ok: false, status: 403, error: "insufficient_scope", mode: "oauth" };
      return { ok: true, status: 200, error: "", mode: "oauth", subject: parsed.payload.sub || "", scopes: [...scopes] };
    },
    status() {
      return {
        mode: "oauth",
        enabled: true,
        requires_auth: true,
        validates_jwt_signature: true,
        accepted_token_source: "authorization_header_only",
        query_token_forbidden: true,
        issuer,
        audience,
        token_validation_mode: jwksCache ? "jwks_rs256" : (introspectionClient ? "introspection" : "hs256_test"),
        jwks_configured: Boolean(jwksCache),
        introspection_configured: Boolean(introspectionClient),
        supported_algs: jwksCache ? ["RS256"] : (introspectionClient ? [] : ["HS256"]),
      };
    },
  };
}

module.exports = {
  createOAuthAuth,
  extractAuthorizationBearerToken,
  hasQueryToken,
  parseJwt,
};
