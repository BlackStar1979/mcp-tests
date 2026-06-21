"use strict";

function hostWithoutPort(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (text.startsWith("[")) return text.slice(1, text.indexOf("]"));
  return text.split(":")[0];
}

function publicHost(publicBaseUrl) {
  try { return new URL(publicBaseUrl).hostname.toLowerCase(); } catch (_) { return ""; }
}

function isAllowedHost(req = {}, { publicBaseUrl } = {}) {
  const host = hostWithoutPort(req.headers?.host || req.headers?.Host || "");
  if (!host) return true;
  const allowed = new Set(["127.0.0.1", "localhost", "::1", publicHost(publicBaseUrl), "mcp-tests-oauth21.romionologic.dev"]);
  return allowed.has(host);
}

function rejectInvalidHost(res) {
  const body = "Invalid Host";
  res.writeHead(421, { "content-type": "text/plain; charset=utf-8", "content-length": Buffer.byteLength(body), "cache-control": "no-store" });
  res.end(body);
}

module.exports = { isAllowedHost, rejectInvalidHost };
