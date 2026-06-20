"use strict";

const fs = require("node:fs");

const DEFAULT_AS_METADATA_TTL_MS = 5 * 60 * 1000;
const MAX_AS_METADATA_BYTES = 128 * 1024;

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function metadataUrlFromIssuer(issuer) {
  const base = trimSlash(issuer);
  if (!base) throw new Error("authorization_server_issuer_required");
  return `${base}/.well-known/oauth-authorization-server`;
}

function assertHttpsUrl(value, field) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_) {
    throw new Error(`${field}_must_be_absolute_url`);
  }
  if (parsed.protocol !== "https:") throw new Error(`${field}_must_use_https`);
  return parsed.toString().replace(/\/+$/, "");
}

function validateAuthorizationServerMetadata(metadata, { expectedIssuer, requireJwksOrIntrospection = true } = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("as_metadata_must_be_object");
  const issuer = assertHttpsUrl(metadata.issuer, "issuer");
  if (expectedIssuer && issuer !== trimSlash(expectedIssuer)) throw new Error("as_metadata_issuer_mismatch");
  const authorizationEndpoint = assertHttpsUrl(metadata.authorization_endpoint, "authorization_endpoint");
  const tokenEndpoint = assertHttpsUrl(metadata.token_endpoint, "token_endpoint");
  const jwksUri = metadata.jwks_uri ? assertHttpsUrl(metadata.jwks_uri, "jwks_uri") : "";
  const introspectionEndpoint = metadata.introspection_endpoint ? assertHttpsUrl(metadata.introspection_endpoint, "introspection_endpoint") : "";
  if (requireJwksOrIntrospection && !jwksUri && !introspectionEndpoint) throw new Error("as_metadata_requires_jwks_or_introspection");
  const registrationEndpoint = metadata.registration_endpoint ? assertHttpsUrl(metadata.registration_endpoint, "registration_endpoint") : "";
  return {
    issuer,
    authorization_endpoint: authorizationEndpoint,
    token_endpoint: tokenEndpoint,
    jwks_uri: jwksUri || undefined,
    introspection_endpoint: introspectionEndpoint || undefined,
    registration_endpoint: registrationEndpoint || undefined,
    response_types_supported: Array.isArray(metadata.response_types_supported) ? metadata.response_types_supported : [],
    grant_types_supported: Array.isArray(metadata.grant_types_supported) ? metadata.grant_types_supported : [],
    code_challenge_methods_supported: Array.isArray(metadata.code_challenge_methods_supported) ? metadata.code_challenge_methods_supported : [],
    scopes_supported: Array.isArray(metadata.scopes_supported) ? metadata.scopes_supported : [],
  };
}

function loadAuthorizationServerMetadataFromFile(path, options = {}) {
  const stat = fs.statSync(path);
  if (stat.size > MAX_AS_METADATA_BYTES) throw new Error("as_metadata_file_too_large");
  const metadata = JSON.parse(fs.readFileSync(path, "utf8"));
  return validateAuthorizationServerMetadata(metadata, options);
}

function createAuthorizationServerMetadataCache({ loader, ttlMs = DEFAULT_AS_METADATA_TTL_MS, now = () => Date.now() } = {}) {
  if (typeof loader !== "function") throw new Error("metadata_loader_required");
  let cached = null;
  let cachedAt = 0;
  return {
    get() {
      const current = now();
      if (cached && current - cachedAt <= ttlMs) return cached;
      cached = loader();
      cachedAt = current;
      return cached;
    },
    clear() {
      cached = null;
      cachedAt = 0;
    },
    status() {
      return { cached: Boolean(cached), cached_at: cachedAt, ttl_ms: ttlMs };
    },
  };
}

function createAuthorizationServerMetadataProvider({ issuer, metadataFile, ttlMs, now } = {}) {
  const expectedIssuer = trimSlash(issuer);
  if (!expectedIssuer) throw new Error("authorization_server_issuer_required");
  if (!metadataFile) {
    const metadataUrl = metadataUrlFromIssuer(expectedIssuer);
    return createAuthorizationServerMetadataCache({
      ttlMs,
      now,
      loader: () => validateAuthorizationServerMetadata({
        issuer: expectedIssuer,
        authorization_endpoint: `${expectedIssuer}/authorize`,
        token_endpoint: `${expectedIssuer}/token`,
        jwks_uri: `${expectedIssuer}/jwks`,
      }, { expectedIssuer }),
    });
  }
  return createAuthorizationServerMetadataCache({
    ttlMs,
    now,
    loader: () => loadAuthorizationServerMetadataFromFile(metadataFile, { expectedIssuer }),
  });
}

module.exports = {
  DEFAULT_AS_METADATA_TTL_MS,
  createAuthorizationServerMetadataCache,
  createAuthorizationServerMetadataProvider,
  loadAuthorizationServerMetadataFromFile,
  metadataUrlFromIssuer,
  validateAuthorizationServerMetadata,
};
