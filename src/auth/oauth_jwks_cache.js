"use strict";

const fs = require("node:fs");

const DEFAULT_JWKS_TTL_MS = 5 * 60 * 1000;
const DEFAULT_UNKNOWN_KID_REFRESH_INTERVAL_MS = 30 * 1000;
const DEFAULT_PREVIOUS_KEY_OVERLAP_MS = 0;
const MAX_JWKS_BYTES = 256 * 1024;

function parseCacheControlMaxAge(header) {
  const text = String(header || "");
  for (const part of text.split(",")) {
    const [rawName, rawValue] = part.trim().split("=");
    if (String(rawName || "").toLowerCase() === "max-age") {
      const parsed = Number(rawValue);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }
  return null;
}

function ttlFromCacheControl(header, { defaultTtlMs = DEFAULT_JWKS_TTL_MS, maxTtlMs = DEFAULT_JWKS_TTL_MS } = {}) {
  const maxAgeSeconds = parseCacheControlMaxAge(header);
  if (maxAgeSeconds === null) return defaultTtlMs;
  return Math.min(maxAgeSeconds * 1000, maxTtlMs);
}

function validateJwks(jwks) {
  if (!jwks || typeof jwks !== "object" || Array.isArray(jwks)) throw new Error("jwks_must_be_object");
  if (!Array.isArray(jwks.keys)) throw new Error("jwks_keys_must_be_array");
  const keys = jwks.keys.map((key) => {
    if (!key || typeof key !== "object" || Array.isArray(key)) throw new Error("jwk_must_be_object");
    if (key.kty !== "RSA") throw new Error("jwk_kty_must_be_rsa");
    if (!key.kid || typeof key.kid !== "string") throw new Error("jwk_kid_required");
    if (key.use && key.use !== "sig") throw new Error("jwk_use_must_be_sig");
    if (key.alg && key.alg !== "RS256") throw new Error("jwk_alg_must_be_rs256");
    if (!key.n || !key.e) throw new Error("jwk_rsa_public_material_required");
    return { ...key, alg: key.alg || "RS256", use: key.use || "sig" };
  });
  return { keys };
}

function loadJwksFromFile(path) {
  const stat = fs.statSync(path);
  if (stat.size > MAX_JWKS_BYTES) throw new Error("jwks_file_too_large");
  return validateJwks(JSON.parse(fs.readFileSync(path, "utf8")));
}

function keyByKid(jwks, kid) {
  return jwks?.keys?.find((candidate) => candidate.kid === kid) || null;
}

function createJwksCache({
  loader,
  ttlMs = DEFAULT_JWKS_TTL_MS,
  maxTtlMs = DEFAULT_JWKS_TTL_MS,
  cacheControlHeader = "",
  unknownKidRefreshIntervalMs = DEFAULT_UNKNOWN_KID_REFRESH_INTERVAL_MS,
  previousKeyOverlapMs = DEFAULT_PREVIOUS_KEY_OVERLAP_MS,
  issuer = "",
  jwksUri = "",
  now = () => Date.now(),
} = {}) {
  if (typeof loader !== "function") throw new Error("jwks_loader_required");
  let cached = null;
  let cachedAt = 0;
  let lastUnknownKidRefreshAt = null;
  const previousKeys = new Map();
  const refreshEvents = [];
  let effectiveTtlMs = ttlFromCacheControl(cacheControlHeader, { defaultTtlMs: ttlMs, maxTtlMs });

  function recordRefresh(reason, extra = {}) {
    refreshEvents.push({ reason, at: now(), ...extra });
    while (refreshEvents.length > 20) refreshEvents.shift();
  }

  function prunePreviousKeys(current = now()) {
    for (const [kid, retained] of previousKeys.entries()) {
      if (retained.expiresAt <= current) previousKeys.delete(kid);
    }
  }

  function retainRemovedKeys(oldJwks, newJwks, current) {
    prunePreviousKeys(current);
    if (!oldJwks || previousKeyOverlapMs <= 0) return;
    const newKids = new Set((newJwks.keys || []).map((key) => key.kid));
    for (const key of oldJwks.keys || []) {
      if (!newKids.has(key.kid)) {
        previousKeys.set(key.kid, { key, expiresAt: current + previousKeyOverlapMs });
      }
    }
  }

  function refresh(reason = "manual") {
    const current = now();
    const old = cached;
    const loaded = loader();
    retainRemovedKeys(old, loaded, current);
    cached = loaded;
    cachedAt = current;
    recordRefresh(reason, { key_count: cached.keys.length });
    return cached;
  }

  function get({ forceRefresh = false, reason = "ttl" } = {}) {
    const current = now();
    prunePreviousKeys(current);
    if (!forceRefresh && cached && current - cachedAt <= effectiveTtlMs) return cached;
    return refresh(reason);
  }

  function findPreviousKey(kid) {
    prunePreviousKeys(now());
    const retained = previousKeys.get(kid);
    return retained ? retained.key : null;
  }

  function findKey(kid, { allowRefresh = true } = {}) {
    if (!kid) return { ok: false, reason: "missing_kid" };
    let jwks = get();
    let key = keyByKid(jwks, kid);
    if (key) return { ok: true, key, source: "current" };

    const retained = findPreviousKey(kid);
    if (retained) return { ok: true, key: retained, source: "previous_overlap" };

    const current = now();
    const canRefreshForUnknownKid = allowRefresh && (lastUnknownKidRefreshAt === null || current - lastUnknownKidRefreshAt >= unknownKidRefreshIntervalMs);
    if (canRefreshForUnknownKid) {
      lastUnknownKidRefreshAt = current;
      jwks = get({ forceRefresh: true, reason: "unknown_kid" });
      key = keyByKid(jwks, kid);
      if (key) return { ok: true, key, source: "refreshed" };
      const retainedAfterRefresh = findPreviousKey(kid);
      if (retainedAfterRefresh) return { ok: true, key: retainedAfterRefresh, source: "previous_overlap" };
    } else if (allowRefresh) {
      recordRefresh("unknown_kid_refresh_suppressed", { kid });
    }
    return { ok: false, reason: "unknown_kid", kid };
  }

  return {
    get,
    refresh,
    findKey,
    clear() {
      cached = null;
      cachedAt = 0;
      lastUnknownKidRefreshAt = null;
      previousKeys.clear();
      refreshEvents.length = 0;
    },
    status() {
      prunePreviousKeys(now());
      return {
        cached: Boolean(cached),
        cached_at: cachedAt,
        ttl_ms: effectiveTtlMs,
        configured_ttl_ms: ttlMs,
        max_ttl_ms: maxTtlMs,
        cache_control_max_age_seconds: parseCacheControlMaxAge(cacheControlHeader),
        key_count: cached?.keys?.length || 0,
        issuer,
        jwks_uri: jwksUri,
        unknown_kid_refresh_interval_ms: unknownKidRefreshIntervalMs,
        previous_key_overlap_ms: previousKeyOverlapMs,
        previous_key_count: previousKeys.size,
        last_unknown_kid_refresh_at: lastUnknownKidRefreshAt || 0,
        recent_refresh_events: [...refreshEvents],
      };
    },
  };
}

function createJwksCacheFromFile({ path, ttlMs, maxTtlMs, cacheControlHeader, now, unknownKidRefreshIntervalMs, previousKeyOverlapMs, issuer, jwksUri } = {}) {
  if (!path) throw new Error("jwks_file_required");
  return createJwksCache({ ttlMs, maxTtlMs, cacheControlHeader, now, unknownKidRefreshIntervalMs, previousKeyOverlapMs, issuer, jwksUri, loader: () => loadJwksFromFile(path) });
}

module.exports = {
  DEFAULT_JWKS_TTL_MS,
  DEFAULT_PREVIOUS_KEY_OVERLAP_MS,
  DEFAULT_UNKNOWN_KID_REFRESH_INTERVAL_MS,
  parseCacheControlMaxAge,
  ttlFromCacheControl,
  createJwksCache,
  createJwksCacheFromFile,
  loadJwksFromFile,
  validateJwks,
};
