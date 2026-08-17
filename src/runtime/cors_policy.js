"use strict";

function configuredAllowedOrigins() {
  return String(process.env.MCP_TEST_CORS_ALLOW_ORIGIN || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function canonicalConfiguredOrigin(value) {
  try {
    const parsed = new URL(String(value || "").trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.origin === "null" ? "" : parsed.origin;
  } catch (_) {
    return "";
  }
}

function canonicalRequestOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "null") return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return "";
    return parsed.origin === "null" ? "" : parsed.origin;
  } catch (_) {
    return "";
  }
}

function isAllowedOrigin(req, { publicBaseUrl } = {}) {
  const rawOrigin = String(req?.headers?.origin || req?.headers?.Origin || "").trim();
  if (!rawOrigin) return true;
  const requestOrigin = canonicalRequestOrigin(rawOrigin);
  if (!requestOrigin) return false;
  const allowed = new Set(configuredAllowedOrigins().map(canonicalConfiguredOrigin).filter(Boolean));
  const publicOrigin = canonicalConfiguredOrigin(publicBaseUrl);
  if (publicOrigin) allowed.add(publicOrigin);
  return allowed.has(requestOrigin);
}

function rejectInvalidOrigin(res) {
  const body = "Invalid Origin";
  res.writeHead(403, { "content-type": "text/plain; charset=utf-8", "content-length": Buffer.byteLength(body), "cache-control": "no-store" });
  res.end(body);
}

function corsHeadersForRequest(req, { authPolicy, publicBaseUrl } = {}) {
  const origin = String(req?.headers?.origin || "").trim();
  const authMode = authPolicy?.mode || "none";
  if (authMode === "none") {
    return { "access-control-allow-origin": "*" };
  }
  const allow = configuredAllowedOrigins();
  if (publicBaseUrl) allow.push(String(publicBaseUrl));
  if (origin && allow.includes(origin)) {
    return { "access-control-allow-origin": origin, vary: "Origin" };
  }
  return { vary: "Origin" };
}

module.exports = { corsHeadersForRequest, configuredAllowedOrigins, isAllowedOrigin, rejectInvalidOrigin };
