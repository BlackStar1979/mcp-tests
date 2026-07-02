"use strict";

const { rpcError } = require("./rpc_responses");

const PROTOCOL_VERSION_HEADER = "mcp-protocol-version";
const PROTOCOL_VERSION_META_KEY = "io.modelcontextprotocol/protocolVersion";
const CLIENT_INFO_META_KEY = "io.modelcontextprotocol/clientInfo";
const CLIENT_CAPABILITIES_META_KEY = "io.modelcontextprotocol/clientCapabilities";
const SUPPORTED_PER_REQUEST_PROTOCOL_VERSIONS = Object.freeze(["2025-06-18"]);
const UNSUPPORTED_PROTOCOL_VERSION = -32004;

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) value = value[0];
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function getRequestMeta(message = {}) {
  if (message && message._meta && typeof message._meta === "object" && !Array.isArray(message._meta)) {
    return message._meta;
  }
  const params = message && message.params && typeof message.params === "object" && !Array.isArray(message.params)
    ? message.params
    : {};
  if (params._meta && typeof params._meta === "object" && !Array.isArray(params._meta)) {
    return params._meta;
  }
  return {};
}

function invalidParams(id, reason, extra = {}) {
  return {
    ok: false,
    httpStatus: 400,
    response: rpcError(id, -32602, "Invalid params", { reason, ...extra }),
    reason,
  };
}

function validatePerRequestMetadata({
  protocolVersionHeader,
  message = {},
  supportedProtocolVersions = SUPPORTED_PER_REQUEST_PROTOCOL_VERSIONS,
} = {}) {
  const id = Object.prototype.hasOwnProperty.call(message, "id") ? message.id : null;
  const headerVersion = normalizeHeaderValue(protocolVersionHeader);
  const meta = getRequestMeta(message);
  const metaVersion = normalizeHeaderValue(meta[PROTOCOL_VERSION_META_KEY]);

  if (!headerVersion) {
    return invalidParams(id, "protocol_version_header_required", { header: "MCP-Protocol-Version" });
  }
  if (!metaVersion) {
    return invalidParams(id, "protocol_version_meta_required", { meta_key: PROTOCOL_VERSION_META_KEY });
  }
  if (headerVersion !== metaVersion) {
    return invalidParams(id, "protocol_version_mismatch", { header: headerVersion, meta: metaVersion });
  }
  if (!supportedProtocolVersions.includes(headerVersion)) {
    return {
      ok: false,
      httpStatus: 400,
      reason: "unsupported_protocol_version",
      response: rpcError(id, UNSUPPORTED_PROTOCOL_VERSION, "Unsupported Protocol Version", {
        reason: "unsupported_protocol_version",
        supported: [...supportedProtocolVersions],
        requested: headerVersion,
      }),
    };
  }

  const clientInfo = meta[CLIENT_INFO_META_KEY];
  if (!clientInfo || typeof clientInfo !== "object" || !clientInfo.name || !clientInfo.version) {
    return invalidParams(id, "client_info_required", { meta_key: CLIENT_INFO_META_KEY });
  }

  const clientCapabilities = meta[CLIENT_CAPABILITIES_META_KEY];
  if (!clientCapabilities || typeof clientCapabilities !== "object" || Array.isArray(clientCapabilities)) {
    return invalidParams(id, "client_capabilities_required", { meta_key: CLIENT_CAPABILITIES_META_KEY });
  }

  return {
    ok: true,
    protocolVersion: headerVersion,
    clientInfo,
    clientCapabilities,
  };
}

module.exports = {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  PROTOCOL_VERSION_HEADER,
  PROTOCOL_VERSION_META_KEY,
  SUPPORTED_PER_REQUEST_PROTOCOL_VERSIONS,
  UNSUPPORTED_PROTOCOL_VERSION,
  getRequestMeta,
  validatePerRequestMetadata,
};
