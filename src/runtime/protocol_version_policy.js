"use strict";

const CURRENT_PROTOCOL_VERSION = "2025-06-18";
const LEGACY_PROTOCOL_VERSION = "2025-03-26";
const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze([CURRENT_PROTOCOL_VERSION, LEGACY_PROTOCOL_VERSION]);
const PROTOCOL_VERSION_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) value = value[0];
  if (value === undefined || value === null || value === "") return undefined;
  return String(value).trim();
}

function isSupportedProtocolVersion(value) {
  return SUPPORTED_PROTOCOL_VERSIONS.includes(value);
}

function negotiateInitializeProtocolVersion(clientVersion) {
  const requested = typeof clientVersion === "string" && clientVersion.trim() ? clientVersion.trim() : CURRENT_PROTOCOL_VERSION;
  if (isSupportedProtocolVersion(requested)) {
    return { ok: true, protocolVersion: requested, requested };
  }
  return { ok: true, protocolVersion: CURRENT_PROTOCOL_VERSION, requested, fallback: true };
}

function evaluateProtocolVersionHeader(req = {}, { requireHeader = false } = {}) {
  const header = normalizeHeaderValue(req.headers?.["mcp-protocol-version"]);
  if (header === undefined) {
    return requireHeader
      ? { ok: false, reason: "missing_mcp_protocol_version" }
      : { ok: true, protocolVersion: LEGACY_PROTOCOL_VERSION, assumed: true };
  }
  if (!PROTOCOL_VERSION_RE.test(header)) {
    return { ok: false, reason: "invalid_mcp_protocol_version", protocolVersion: header };
  }
  if (!isSupportedProtocolVersion(header)) {
    return { ok: false, reason: "unsupported_mcp_protocol_version", protocolVersion: header };
  }
  return { ok: true, protocolVersion: header, assumed: false };
}

module.exports = {
  CURRENT_PROTOCOL_VERSION,
  LEGACY_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  evaluateProtocolVersionHeader,
  isSupportedProtocolVersion,
  negotiateInitializeProtocolVersion,
};
