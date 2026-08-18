"use strict";

const {
  CURRENT_LEGACY_PROTOCOL_VERSION: CURRENT_PROTOCOL_VERSION,
  LEGACY_PROTOCOL_VERSION,
  MODERN_PROTOCOL_VERSION,
  SUPPORTED_LEGACY_PROTOCOL_VERSIONS,
  SUPPORTED_PROTOCOL_VERSIONS,
} = require("./protocol_capability_registry");
const PROTOCOL_VERSION_RE = /^\d{4}-\d{2}-\d{2}$/;
function normalizeHeaderValue(value) {
  if (Array.isArray(value)) value = value[0];
  if (value === undefined || value === null || value === "") return undefined;
  return String(value).trim();
}

function isSupportedProtocolVersion(value) {
  return SUPPORTED_PROTOCOL_VERSIONS.includes(value);
}

function isModernProtocolVersion(value) {
  return value === MODERN_PROTOCOL_VERSION;
}

function negotiateInitializeProtocolVersion(clientVersion) {
  const requested = typeof clientVersion === "string" && clientVersion.trim() ? clientVersion.trim() : CURRENT_PROTOCOL_VERSION;
  if (SUPPORTED_LEGACY_PROTOCOL_VERSIONS.includes(requested)) {
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
  MODERN_PROTOCOL_VERSION,
  SUPPORTED_LEGACY_PROTOCOL_VERSIONS,
  SUPPORTED_PROTOCOL_VERSIONS,
  evaluateProtocolVersionHeader,
  isModernProtocolVersion,
  isSupportedProtocolVersion,
  negotiateInitializeProtocolVersion,
};
