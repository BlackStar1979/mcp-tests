"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { readRequestBody } = require("./request_body");
const { jsonResponse } = require("./http_responses");
const { rpcResult, rpcError } = require("./rpc_responses");
const { createRequestIdGenerator } = require("./request_id");
const { createStateHandleStore, extractAuthContext, redactStateHandle, summarizeRecord } = require("./state_handle_prototype");

const ROUTE_PATH = "/mcp/sessionless";
const ENABLE_FLAG = "MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE";
const CONTROL_FILE = path.join("_control", "sessionless-prototype.json");
const PROTOCOL_VERSION_HEADER = "mcp-protocol-version";
const PROTOCOL_VERSION_META_KEY = "io.modelcontextprotocol/protocolVersion";
const CLIENT_INFO_META_KEY = "io.modelcontextprotocol/clientInfo";
const CLIENT_CAPABILITIES_META_KEY = "io.modelcontextprotocol/clientCapabilities";
const SUPPORTED_SESSIONLESS_PROTOCOL_VERSIONS = Object.freeze(["2025-06-18"]);
const UNSUPPORTED_PROTOCOL_VERSION = -32004;

function truthy(v) {
  return ["1", "true", "yes", "on"].includes(String(v || "").trim().toLowerCase());
}
function controlFileEnabled({ rootDir = path.resolve(__dirname, "../..") } = {}) {
  const file = path.join(rootDir, CONTROL_FILE);
  if (!fs.existsSync(file)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return truthy(data && data.enabled);
  } catch (_) {
    return false;
  }
}
function envEnabled(env = process.env, opts = {}) {
  return truthy(env[ENABLE_FLAG]) || controlFileEnabled(opts);
}

function getHeader(req, name) {
  const headers = req && req.headers ? req.headers : {};
  const value = headers[String(name || "").toLowerCase()];
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function getRequestMeta(message = {}) {
  if (message && message._meta && typeof message._meta === "object" && !Array.isArray(message._meta)) return message._meta;
  const params = message && message.params && typeof message.params === "object" && !Array.isArray(message.params) ? message.params : {};
  if (params._meta && typeof params._meta === "object" && !Array.isArray(params._meta)) return params._meta;
  return {};
}

function invalidParams(id, reason, extra = {}) {
  return { ok: false, httpStatus: 400, response: rpcError(id, -32602, "Invalid params", { reason, ...extra }), reason };
}

function validateSessionlessRequestMetadata({ req, message = {} } = {}) {
  const id = Object.prototype.hasOwnProperty.call(message, "id") ? message.id : null;
  const headerVersion = getHeader(req, PROTOCOL_VERSION_HEADER);
  const meta = getRequestMeta(message);
  const metaVersion = String(meta[PROTOCOL_VERSION_META_KEY] || "").trim();
  if (!headerVersion) return invalidParams(id, "protocol_version_header_required", { header: "MCP-Protocol-Version" });
  if (!metaVersion) return invalidParams(id, "protocol_version_meta_required", { meta_key: PROTOCOL_VERSION_META_KEY });
  if (headerVersion !== metaVersion) return invalidParams(id, "protocol_version_mismatch", { header: headerVersion, meta: metaVersion });
  if (!SUPPORTED_SESSIONLESS_PROTOCOL_VERSIONS.includes(headerVersion)) {
    return { ok: false, httpStatus: 400, reason: "unsupported_protocol_version", response: rpcError(id, UNSUPPORTED_PROTOCOL_VERSION, "Unsupported Protocol Version", { reason: "unsupported_protocol_version", supported: [...SUPPORTED_SESSIONLESS_PROTOCOL_VERSIONS], requested: headerVersion }) };
  }
  const clientInfo = meta[CLIENT_INFO_META_KEY];
  if (!clientInfo || typeof clientInfo !== "object" || !clientInfo.name || !clientInfo.version) return invalidParams(id, "client_info_required", { meta_key: CLIENT_INFO_META_KEY });
  const clientCapabilities = meta[CLIENT_CAPABILITIES_META_KEY];
  if (!clientCapabilities || typeof clientCapabilities !== "object" || Array.isArray(clientCapabilities)) return invalidParams(id, "client_capabilities_required", { meta_key: CLIENT_CAPABILITIES_META_KEY });
  return { ok: true, protocolVersion: headerVersion, clientInfo, clientCapabilities };
}

function buildContext({ authResult = {}, authPolicy = {}, publicBaseUrl = "", runtimeProfile = "" } = {}) {
  return extractAuthContext(authResult, {
    audience: authPolicy.audience || publicBaseUrl,
    profile: runtimeProfile,
  });
}

function dispatchSessionlessPrototypeMessage({ message = {}, authContext = {}, requestMetadata = {}, store, serverName, serverVersion, connectorShapeVersion }) {
  const id = Object.prototype.hasOwnProperty.call(message, "id") ? message.id : null;
  const method = String(message.method || "");
  const params = message.params && typeof message.params === "object" ? message.params : {};

  if (!message || message.jsonrpc !== "2.0" || !method) {
    return rpcError(id, -32600, "Invalid Request", { reason: "invalid_jsonrpc_message" });
  }

  if (method === "initialize") {
    return rpcError(id, -32000, "Initialize is not supported on this sessionless prototype", { reason: "initialize_not_supported_sessionless" });
  }

  if (method === "ping") return rpcResult(id, {});

  if (method === "server/discover") {
    return rpcResult(id, {
      supportedVersions: [...SUPPORTED_SESSIONLESS_PROTOCOL_VERSIONS],
      capabilities: { tools: {}, experimental: { sessionless: true, explicitStateHandles: true } },
      serverInfo: { name: serverName, version: serverVersion, connectorShapeVersion },
      protocolVersion: requestMetadata.protocolVersion || SUPPORTED_SESSIONLESS_PROTOCOL_VERSIONS[0],
      server: { name: serverName, version: serverVersion, connectorShapeVersion },
      transport: { mode: "sessionless_prototype", route: ROUTE_PATH, post_only: true, protocol_sessions: false, initialize_required: false },
      state_handles: { supported: true, argument_name: "state_handle", possession_is_authorization: false },
    });
  }

  if (method === "state/handle/create") {
    const created = store.create({
      kind: params.kind || "tool_workflow_state",
      payload: params.payload || {},
      authContext,
      ttlMs: params.ttlMs,
    });
    return rpcResult(id, {
      state_handle: created.handle,
      handle: summarizeRecord(created.record),
    });
  }

  if (method === "state/handle/read") {
    const stateHandle = String(params.state_handle || params.handle || "");
    if (!stateHandle) return rpcError(id, -32602, "Invalid params", { reason: "state_handle_required" });
    const result = store.read({ handle: stateHandle, authContext, kind: params.kind });
    if (!result.ok) return rpcError(id, -32010, "State handle rejected", { reason: result.reason, handle: result.record || result.redacted });
    return rpcResult(id, { handle: result.summary, payload: result.payload });
  }

  if (method === "state/handle/destroy") {
    const stateHandle = String(params.state_handle || params.handle || "");
    if (!stateHandle) return rpcError(id, -32602, "Invalid params", { reason: "state_handle_required" });
    const result = store.destroy({ handle: stateHandle, authContext, kind: params.kind });
    if (!result.ok) return rpcError(id, -32010, "State handle rejected", { reason: result.reason, handle: result.record || result.redacted });
    return rpcResult(id, { destroyed: true, handle: result.summary });
  }

  return rpcError(id, -32601, "Method not found", { method });
}

function createSessionlessPrototypeRouteHandler({
  env = process.env,
  authPolicy,
  auditLog = () => {},
  publicBaseUrl = "",
  runtimeProfile = "",
  serverName,
  serverVersion,
  connectorShapeVersion,
  rootDir = path.resolve(__dirname, "../.."),
  store = createStateHandleStore(),
} = {}) {
  const nextRequestId = createRequestIdGenerator();
  const enabled = envEnabled(env, { rootDir });

  async function handleRoute({ req, res, url }) {
    if (!url || url.pathname !== ROUTE_PATH) return false;
    if (!enabled) return false;
    const requestId = nextRequestId();

    if (req.method !== "POST") {
      auditLog("sessionless_prototype_rejected", { request_id: requestId, reason: "post_only", http_method: req.method });
      jsonResponse(res, 405, { error: "sessionless_prototype_post_only" });
      return true;
    }

    if (!authPolicy || authPolicy.requiresAuth !== true) {
      auditLog("sessionless_prototype_auth_rejected", { request_id: requestId, auth_error: "auth_required" });
      jsonResponse(res, 403, rpcError(null, -32001, "Unauthorized", { auth_error: "auth_required" }));
      return true;
    }

    const authResult = authPolicy.authenticate(req);
    if (!authResult.ok) {
      auditLog("sessionless_prototype_auth_rejected", { request_id: requestId, auth_error: authResult.error || "" });
      jsonResponse(res, authResult.status || 401, rpcError(null, -32001, "Unauthorized", { auth_error: authResult.error || "" }));
      return true;
    }

    let raw = "";
    let message;
    try {
      raw = await readRequestBody(req);
      message = JSON.parse(raw || "null");
    } catch (error) {
      auditLog("sessionless_prototype_parse_error", { request_id: requestId, error_message: error?.message || String(error) });
      jsonResponse(res, 400, rpcError(null, -32700, "Parse error"));
      return true;
    }

    if (Array.isArray(message)) {
      auditLog("sessionless_prototype_rejected", { request_id: requestId, reason: "batch_not_supported" });
      jsonResponse(res, 200, rpcError(null, -32600, "Invalid Request", { reason: "batch_not_supported_sessionless_prototype" }));
      return true;
    }

    const metadataValidation = validateSessionlessRequestMetadata({ req, message });
    if (!metadataValidation.ok) {
      auditLog("sessionless_prototype_rejected", { request_id: requestId, reason: metadataValidation.reason, method: message && message.method ? String(message.method) : "" });
      jsonResponse(res, metadataValidation.httpStatus, metadataValidation.response);
      return true;
    }

    const authContext = buildContext({ authResult, authPolicy, publicBaseUrl, runtimeProfile });
    const response = dispatchSessionlessPrototypeMessage({ message, authContext, requestMetadata: metadataValidation, store, serverName, serverVersion, connectorShapeVersion });
    auditLog("sessionless_prototype_rpc", {
      request_id: requestId,
      method: message && message.method ? String(message.method) : "",
      has_state_handle: Boolean(message && message.params && (message.params.state_handle || message.params.handle)),
      state_handle: message && message.params ? redactStateHandle(message.params.state_handle || message.params.handle || "") : redactStateHandle(""),
      response_error: Boolean(response && response.error),
    });
    jsonResponse(res, 200, response);
    return true;
  }

  return { enabled, routePath: ROUTE_PATH, handleRoute, store };
}

module.exports = {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  CONTROL_FILE,
  ENABLE_FLAG,
  PROTOCOL_VERSION_HEADER,
  PROTOCOL_VERSION_META_KEY,
  ROUTE_PATH,
  SUPPORTED_SESSIONLESS_PROTOCOL_VERSIONS,
  UNSUPPORTED_PROTOCOL_VERSION,
  buildContext,
  createSessionlessPrototypeRouteHandler,
  dispatchSessionlessPrototypeMessage,
  controlFileEnabled,
  envEnabled,
  getRequestMeta,
  validateSessionlessRequestMetadata,
};
