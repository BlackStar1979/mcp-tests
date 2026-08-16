"use strict";

const dns = require("node:dns").promises;
const https = require("node:https");
const net = require("node:net");

const CIMD_MAX_BYTES = 5 * 1024;
const CIMD_TIMEOUT_MS = 8_000;
const CIMD_DEFAULT_CACHE_MS = 60_000;
const CIMD_MAX_CACHE_MS = 5 * 60_000;
const MAX_CLIENT_ID_CHARS = 4096;

class CimdError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "CimdError";
    this.code = code;
  }
}

const SPECIAL_USE_IPV4 = new net.BlockList();
const SPECIAL_USE_IPV6 = new net.BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.31.196.0", 24],
  ["192.52.193.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["192.175.48.0", 24],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]) {
  SPECIAL_USE_IPV4.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["100:0:0:1::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["2620:4f:8000::", 48],
  ["3fff::", 20],
  ["5f00::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
]) {
  SPECIAL_USE_IPV6.addSubnet(network, prefix, "ipv6");
}

function cimdError(code, message) {
  return new CimdError(code, message);
}

function stripIpv6Brackets(hostname) {
  const value = String(hostname || "");
  return value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
}

function isSpecialUseIp(address) {
  const value = stripIpv6Brackets(address);
  const family = net.isIP(value);
  if (family === 4) return SPECIAL_USE_IPV4.check(value, "ipv4");
  if (family === 6) return SPECIAL_USE_IPV6.check(value, "ipv6");
  return true;
}

function rawPathFromClientId(raw) {
  const scheme = raw.indexOf("://");
  if (scheme < 0) return "";
  const authorityStart = scheme + 3;
  const slash = raw.indexOf("/", authorityStart);
  const query = raw.indexOf("?", authorityStart);
  const fragment = raw.indexOf("#", authorityStart);
  const boundaryCandidates = [query, fragment].filter((item) => item >= 0);
  const authorityEnd = boundaryCandidates.length ? Math.min(...boundaryCandidates) : raw.length;
  if (slash < 0 || slash >= authorityEnd) return "";
  const endCandidates = [query, fragment].filter((item) => item >= slash);
  const pathEnd = endCandidates.length ? Math.min(...endCandidates) : raw.length;
  return raw.slice(slash, pathEnd);
}

function hasDotSegment(rawPath) {
  return rawPath.split("/").some((segment) => {
    if (!segment) return false;
    let decoded;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      throw cimdError("cimd_url_invalid", "Client ID contains invalid percent-encoding.");
    }
    return decoded === "." || decoded === "..";
  });
}

function validateClientIdUrl(value) {
  const raw = String(value || "");
  if (!raw || raw.length > MAX_CLIENT_ID_CHARS) {
    throw cimdError("cimd_url_invalid", "Client ID URL is required and bounded.");
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw cimdError("cimd_url_invalid", "Client ID is not a valid URL.");
  }
  if (parsed.protocol !== "https:") throw cimdError("cimd_https_required");
  if (parsed.username || parsed.password) throw cimdError("cimd_userinfo_forbidden");
  if (parsed.hash) throw cimdError("cimd_fragment_forbidden");

  const rawPath = rawPathFromClientId(raw);
  if (!rawPath) throw cimdError("cimd_path_required");
  if (hasDotSegment(rawPath)) throw cimdError("cimd_dot_segment_forbidden");

  const hostname = stripIpv6Brackets(parsed.hostname);
  if (!hostname) throw cimdError("cimd_hostname_required");
  return { clientId: raw, url: parsed, hostname };
}

function normalizeHeaders(headers = {}) {
  const output = {};
  if (headers && typeof headers.forEach === "function") {
    headers.forEach((value, key) => { output[String(key).toLowerCase()] = String(value); });
    return output;
  }
  for (const [key, value] of Object.entries(headers || {})) {
    if (Array.isArray(value)) output[String(key).toLowerCase()] = value.join(", ");
    else if (value !== undefined && value !== null) output[String(key).toLowerCase()] = String(value);
  }
  return output;
}

function cacheLifetimeMs(headers = {}) {
  const normalized = normalizeHeaders(headers);
  const control = normalized["cache-control"] || "";
  if (/(?:^|,)\s*(?:no-store|no-cache)\b/i.test(control)) return 0;
  const match = control.match(/(?:^|,)\s*(?:s-maxage|max-age)\s*=\s*"?(\d+)"?/i);
  if (!match) return CIMD_DEFAULT_CACHE_MS;
  const maxAgeSeconds = Number(match[1]);
  const ageSecondsRaw = Number(normalized.age || 0);
  const ageSeconds = Number.isFinite(ageSecondsRaw) && ageSecondsRaw > 0 ? ageSecondsRaw : 0;
  return Math.min(Math.max(maxAgeSeconds - ageSeconds, 0) * 1000, CIMD_MAX_CACHE_MS);
}

function containsPrivateJwkMaterial(jwks) {
  const keys = Array.isArray(jwks?.keys) ? jwks.keys : [];
  const privateParameters = new Set(["d", "p", "q", "dp", "dq", "qi", "oth", "k"]);
  return keys.some((key) => key && typeof key === "object" && [...privateParameters].some((name) => Object.prototype.hasOwnProperty.call(key, name)));
}

function validateClientMetadata(clientId, value, validateRedirectUri) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw cimdError("cimd_document_invalid", "Client metadata must be a JSON object.");
  }
  if (String(value.client_id || "") !== clientId) throw cimdError("cimd_client_id_mismatch");
  if (!String(value.client_name || "").trim()) throw cimdError("cimd_client_name_required");
  if (!Array.isArray(value.redirect_uris) || value.redirect_uris.length === 0) {
    throw cimdError("cimd_redirect_uris_required");
  }
  const redirects = [];
  for (const item of value.redirect_uris) {
    const checked = validateRedirectUri ? validateRedirectUri(item) : { ok: typeof item === "string" && item.length > 0, value: item };
    if (!checked?.ok) throw cimdError("cimd_redirect_uri_invalid", checked?.reason || "redirect_uri_invalid");
    redirects.push(checked.value);
  }

  if (Object.prototype.hasOwnProperty.call(value, "client_secret")
      || Object.prototype.hasOwnProperty.call(value, "client_secret_expires_at")) {
    throw cimdError("cimd_shared_secret_forbidden");
  }
  if (containsPrivateJwkMaterial(value.jwks)) throw cimdError("cimd_private_key_material_forbidden");
  const authMethod = String(value.token_endpoint_auth_method || "none");
  if (authMethod !== "none") throw cimdError("cimd_token_auth_method_unsupported");
  if (Array.isArray(value.grant_types) && !value.grant_types.includes("authorization_code")) {
    throw cimdError("cimd_authorization_code_required");
  }
  if (Array.isArray(value.response_types) && !value.response_types.includes("code")) {
    throw cimdError("cimd_code_response_required");
  }

  return {
    ...value,
    client_id: clientId,
    client_name: String(value.client_name),
    redirect_uris: redirects,
    token_endpoint_auth_method: "none",
  };
}

async function defaultLookup(hostname) {
  const literal = stripIpv6Brackets(hostname);
  const family = net.isIP(literal);
  if (family) return [{ address: literal, family }];
  return dns.lookup(hostname, { all: true, verbatim: true });
}

function pinnedLookup(resolvedAddresses) {
  let cursor = 0;
  return (_hostname, options, callback) => {
    const items = resolvedAddresses;
    if (options && options.all) {
      callback(null, items.map((item) => ({ address: item.address, family: item.family })));
      return;
    }
    const chosen = items[cursor % items.length];
    cursor += 1;
    callback(null, chosen.address, chosen.family);
  };
}

function defaultFetchDocument(urlInfo, { resolvedAddresses, maxBytes = CIMD_MAX_BYTES, timeoutMs = CIMD_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const connectHostname = stripIpv6Brackets(urlInfo.hostname);
    const tlsServername = net.isIP(connectHostname) ? undefined : connectHostname;
    const request = https.request({
      protocol: "https:",
      hostname: connectHostname,
      port: urlInfo.port || 443,
      path: `${urlInfo.pathname}${urlInfo.search}`,
      method: "GET",
      servername: tlsServername,
      lookup: pinnedLookup(resolvedAddresses),
      agent: false,
      headers: {
        accept: "application/json, application/*+json;q=0.9",
        "user-agent": "mcp-tests-cimd/1.0",
      },
    }, (response) => {
      const headers = normalizeHeaders(response.headers);
      const contentLength = Number(headers["content-length"] || 0);
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        response.resume();
        reject(cimdError("cimd_response_too_large"));
        return;
      }

      const chunks = [];
      let bytes = 0;
      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > maxBytes) {
          request.destroy(cimdError("cimd_response_too_large"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        resolve({ status: response.statusCode || 0, headers, body: Buffer.concat(chunks) });
      });
    });

    request.setTimeout(timeoutMs, () => request.destroy(cimdError("cimd_timeout")));
    request.on("error", (error) => {
      if (error instanceof CimdError) reject(error);
      else reject(cimdError("cimd_fetch_failed", error.message));
    });
    request.end();
  });
}

function createClientIdMetadataResolver({
  lookup = defaultLookup,
  fetchDocument = defaultFetchDocument,
  validateRedirectUri = null,
  now = () => Date.now(),
  maxBytes = CIMD_MAX_BYTES,
  timeoutMs = CIMD_TIMEOUT_MS,
} = {}) {
  const cache = new Map();

  async function resolve(clientIdInput) {
    const target = validateClientIdUrl(clientIdInput);
    const cached = cache.get(target.clientId);
    const current = now();
    if (cached && cached.expiresAt > current) {
      return { client: { ...cached.client, redirect_uris: [...cached.client.redirect_uris] }, cacheHit: true };
    }
    cache.delete(target.clientId);

    let resolvedAddresses;
    try {
      resolvedAddresses = await lookup(target.hostname, { all: true, verbatim: true });
    } catch (error) {
      throw cimdError("cimd_dns_failed", error?.message || "DNS resolution failed.");
    }
    if (!Array.isArray(resolvedAddresses) || resolvedAddresses.length === 0) {
      throw cimdError("cimd_dns_failed", "DNS resolution returned no addresses.");
    }
    for (const item of resolvedAddresses) {
      if (!item || isSpecialUseIp(item.address)) throw cimdError("cimd_special_use_ip");
    }

    const response = await fetchDocument(target.url, {
      resolvedAddresses: resolvedAddresses.map((item) => ({ address: item.address, family: Number(item.family) || net.isIP(item.address) })),
      maxBytes,
      timeoutMs,
    });
    if (!response || Number(response.status) !== 200) throw cimdError("cimd_http_status");

    const headers = normalizeHeaders(response.headers);
    const body = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body || "");
    if (body.length > maxBytes) throw cimdError("cimd_response_too_large");
    const mediaType = String(headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (mediaType && mediaType !== "application/json" && !/^application\/[a-z0-9!#$&^_.+-]+\+json$/i.test(mediaType)) {
      throw cimdError("cimd_content_type_invalid");
    }

    let metadata;
    try {
      metadata = JSON.parse(body.toString("utf8"));
    } catch {
      throw cimdError("cimd_json_invalid");
    }
    const client = validateClientMetadata(target.clientId, metadata, validateRedirectUri);
    const ttlMs = cacheLifetimeMs(headers);
    if (ttlMs > 0) {
      cache.set(target.clientId, { client, expiresAt: current + ttlMs });
    }
    return { client: { ...client, redirect_uris: [...client.redirect_uris] }, cacheHit: false };
  }

  return { resolve };
}

module.exports = {
  CIMD_MAX_BYTES,
  CIMD_TIMEOUT_MS,
  CimdError,
  createClientIdMetadataResolver,
  isSpecialUseIp,
  validateClientIdUrl,
  validateClientMetadata,
};
