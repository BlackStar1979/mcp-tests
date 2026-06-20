"use strict";

function configuredAllowedOrigins() {
  return String(process.env.MCP_TEST_CORS_ALLOW_ORIGIN || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

module.exports = { corsHeadersForRequest, configuredAllowedOrigins };
