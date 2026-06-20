"use strict";

const fs = require("node:fs");

const DEFAULT_INTROSPECTION_CACHE_TTL_MS = 60 * 1000;
const MAX_INTROSPECTION_FILE_BYTES = 256 * 1024;

function normalizeScope(raw) {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean).join(" ");
  return String(raw || "").trim();
}

function scopeSet(raw) {
  return new Set(normalizeScope(raw).split(/\s+/).filter(Boolean));
}

function audienceMatches(value, audience) {
  if (Array.isArray(value)) return value.includes(audience);
  return String(value || "") === audience;
}

function validateIntrospectionResponse(response, { issuer, audience, now = Math.floor(Date.now() / 1000) } = {}) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return { ok: false, status: 401, error: "invalid_introspection_response" };
  }
  if (response.active !== true) {
    return { ok: false, status: 401, error: "inactive_token" };
  }
  if (response.iss !== undefined && response.iss !== issuer) {
    return { ok: false, status: 401, error: "invalid_issuer" };
  }
  if (response.aud !== undefined && !audienceMatches(response.aud, audience)) {
    return { ok: false, status: 401, error: "invalid_audience" };
  }
  if (typeof response.exp === "number" && response.exp <= now) {
    return { ok: false, status: 401, error: "token_expired" };
  }
  if (typeof response.nbf === "number" && response.nbf > now) {
    return { ok: false, status: 401, error: "token_not_yet_valid" };
  }
  const scopes = scopeSet(response.scope || response.scp);
  if (!(scopes.has("mcp:tools") || scopes.has("mcp:public") || scopes.has("mcp:operator"))) {
    return { ok: false, status: 403, error: "insufficient_scope" };
  }
  return {
    ok: true,
    status: 200,
    subject: response.sub || "",
    scopes: [...scopes],
    claims: response,
  };
}

function loadIntrospectionFixtures(path) {
  const stat = fs.statSync(path);
  if (stat.size > MAX_INTROSPECTION_FILE_BYTES) throw new Error("introspection_file_too_large");
  const parsed = JSON.parse(fs.readFileSync(path, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("introspection_file_must_be_object");
  return parsed;
}

function createFileIntrospectionClient({ responseFile, issuer, audience, cacheTtlMs = DEFAULT_INTROSPECTION_CACHE_TTL_MS, nowMs = () => Date.now() } = {}) {
  if (!responseFile) throw new Error("introspection_response_file_required");
  const positiveCache = new Map();

  function introspect(token) {
    const currentMs = nowMs();
    const cached = positiveCache.get(token);
    if (cached && currentMs - cached.cachedAt <= cacheTtlMs) return cached.result;
    const fixtures = loadIntrospectionFixtures(responseFile);
    const response = fixtures[token] || fixtures.default || null;
    const result = validateIntrospectionResponse(response, { issuer, audience, now: Math.floor(currentMs / 1000) });
    if (result.ok) positiveCache.set(token, { result, cachedAt: currentMs });
    else positiveCache.delete(token);
    return result;
  }

  return {
    introspect,
    status() {
      return {
        mode: "file_introspection",
        response_file_configured: true,
        positive_cache_size: positiveCache.size,
        cache_ttl_ms: cacheTtlMs,
      };
    },
    clear() { positiveCache.clear(); },
  };
}

module.exports = {
  DEFAULT_INTROSPECTION_CACHE_TTL_MS,
  createFileIntrospectionClient,
  loadIntrospectionFixtures,
  validateIntrospectionResponse,
};
