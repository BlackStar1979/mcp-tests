"use strict";

const { rpcError } = require("./rpc_responses");

const PROTOCOL_VERSION_HEADER = "mcp-protocol-version";
const METHOD_HEADER = "mcp-method";
const NAME_HEADER = "mcp-name";
const PROTOCOL_VERSION_META_KEY = "io.modelcontextprotocol/protocolVersion";
const CLIENT_INFO_META_KEY = "io.modelcontextprotocol/clientInfo";
const CLIENT_CAPABILITIES_META_KEY = "io.modelcontextprotocol/clientCapabilities";
const SERVER_INFO_META_KEY = "io.modelcontextprotocol/serverInfo";
const SUPPORTED_PER_REQUEST_PROTOCOL_VERSIONS = Object.freeze(["2026-07-28", "2025-06-18"]);
const HEADER_MISMATCH = -32020;
const MISSING_REQUIRED_CLIENT_CAPABILITY = -32021;
const UNSUPPORTED_PROTOCOL_VERSION = -32022;

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

function protocolError(id, code, message, reason, extra = {}) {
  return {
    ok: false,
    httpStatus: 400,
    response: rpcError(id, code, message, { reason, ...extra }),
    reason,
  };
}

function headerMismatch(id, reason, extra = {}) {
  return protocolError(id, HEADER_MISMATCH, "Header mismatch", reason, extra);
}

function decodeMirroredHeader(value) {
  const normalized = normalizeHeaderValue(value);
  if (!normalized) return { ok: true, value: "" };
  if (normalized.startsWith("=?base64?") && normalized.endsWith("?=")) {
    const encoded = normalized.slice(9, -2);
    if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
      return { ok: false, reason: "invalid_base64_sentinel" };
    }
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    if (Buffer.from(decoded, "utf8").toString("base64") !== encoded) {
      return { ok: false, reason: "invalid_base64_sentinel" };
    }
    return { ok: true, value: decoded };
  }
  if (!/^[\x20-\x7e]*$/.test(normalized)) {
    return { ok: false, reason: "invalid_header_characters" };
  }
  return { ok: true, value: normalized };
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
    return headerMismatch(id, "protocol_version_header_required", { header: "MCP-Protocol-Version" });
  }
  if (!metaVersion) {
    return headerMismatch(id, "protocol_version_meta_required", { meta_key: PROTOCOL_VERSION_META_KEY });
  }
  if (headerVersion !== metaVersion) {
    return headerMismatch(id, "protocol_version_mismatch", { header: headerVersion, meta: metaVersion });
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
  if (clientInfo !== undefined && (!clientInfo || typeof clientInfo !== "object" || !clientInfo.name || !clientInfo.version)) {
    return invalidParams(id, "client_info_invalid", { meta_key: CLIENT_INFO_META_KEY });
  }

  const clientCapabilities = meta[CLIENT_CAPABILITIES_META_KEY];
  if (!clientCapabilities || typeof clientCapabilities !== "object" || Array.isArray(clientCapabilities)) {
    return protocolError(
      id,
      MISSING_REQUIRED_CLIENT_CAPABILITY,
      "Missing required client capability",
      "client_capabilities_required",
      { meta_key: CLIENT_CAPABILITIES_META_KEY }
    );
  }

  return {
    ok: true,
    protocolVersion: headerVersion,
    clientInfo: clientInfo || null,
    clientCapabilities,
  };
}

function validateModernHttpHeaders({ headers = {}, message = {} } = {}) {
  const id = Object.prototype.hasOwnProperty.call(message, "id") ? message.id : null;
  const method = typeof message.method === "string" ? message.method : "";
  const methodHeader = normalizeHeaderValue(headers[METHOD_HEADER]);
  if (!methodHeader) return headerMismatch(id, "method_header_required", { header: "Mcp-Method" });
  if (methodHeader !== method) {
    return headerMismatch(id, "method_header_mismatch", { header: methodHeader, body: method });
  }

  const taskMethod = method === "tasks/get" || method === "tasks/update" || method === "tasks/cancel";
  const nameSource = method === "tools/call" || method === "prompts/get"
    ? message.params?.name
    : method === "resources/read"
      ? message.params?.uri
      : taskMethod ? message.params?.taskId : undefined;
  if (nameSource !== undefined) {
    const decoded = decodeMirroredHeader(headers[NAME_HEADER]);
    if (!normalizeHeaderValue(headers[NAME_HEADER])) {
      return headerMismatch(id, "name_header_required", { header: "Mcp-Name" });
    }
    if (!decoded.ok) return headerMismatch(id, decoded.reason, { header: "Mcp-Name" });
    if (decoded.value !== String(nameSource)) {
      return headerMismatch(id, "name_header_mismatch", { header: decoded.value, body: String(nameSource) });
    }
  }

  return { ok: true };
}

module.exports = {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  HEADER_MISMATCH,
  METHOD_HEADER,
  MISSING_REQUIRED_CLIENT_CAPABILITY,
  NAME_HEADER,
  PROTOCOL_VERSION_HEADER,
  PROTOCOL_VERSION_META_KEY,
  SERVER_INFO_META_KEY,
  SUPPORTED_PER_REQUEST_PROTOCOL_VERSIONS,
  UNSUPPORTED_PROTOCOL_VERSION,
  getRequestMeta,
  validateModernHttpHeaders,
  validatePerRequestMetadata,
};
