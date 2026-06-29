"use strict";
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  PROTOCOL_VERSION_HEADER,
  PROTOCOL_VERSION_META_KEY,
  ROUTE_PATH,
  SUPPORTED_SESSIONLESS_PROTOCOL_VERSIONS,
  UNSUPPORTED_PROTOCOL_VERSION,
  createSessionlessPrototypeRouteHandler,
  dispatchSessionlessPrototypeMessage,
  validateSessionlessRequestMetadata,
} = require("../src/runtime/sessionless_prototype_route_handler");

function meta(version = "2025-06-18") {
  return {
    [PROTOCOL_VERSION_META_KEY]: version,
    [CLIENT_INFO_META_KEY]: { name: "s7-smoke", version: "1.0.0" },
    [CLIENT_CAPABILITIES_META_KEY]: {},
  };
}
function message(method = "server/discover", version = "2025-06-18") {
  return { jsonrpc: "2.0", id: 1, method, params: { _meta: meta(version) } };
}
function req(body, headers = {}) {
  const stream = Readable.from([Buffer.from(JSON.stringify(body))]);
  stream.method = "POST";
  stream.headers = headers;
  return stream;
}
function fakeRes() {
  return { statusCode: 0, headers: {}, body: "", writeHead(c, h = {}) { this.statusCode = c; this.headers = h; }, end(c = "") { this.body += String(c || ""); } };
}
const goodReq = { headers: { [PROTOCOL_VERSION_HEADER]: "2025-06-18" } };
assert.deepEqual(SUPPORTED_SESSIONLESS_PROTOCOL_VERSIONS, ["2025-06-18"]);
assert.equal(UNSUPPORTED_PROTOCOL_VERSION, -32004);
assert.equal(validateSessionlessRequestMetadata({ req: goodReq, message: message() }).ok, true);
assert.equal(validateSessionlessRequestMetadata({ req: { headers: {} }, message: message() }).reason, "protocol_version_header_required");
assert.equal(validateSessionlessRequestMetadata({ req: goodReq, message: { jsonrpc: "2.0", id: 2, method: "ping", params: {} } }).reason, "protocol_version_meta_required");
assert.equal(validateSessionlessRequestMetadata({ req: goodReq, message: message("ping", "2025-03-26") }).reason, "protocol_version_mismatch");
const unsupported = validateSessionlessRequestMetadata({ req: { headers: { [PROTOCOL_VERSION_HEADER]: "2099-01-01" } }, message: message("ping", "2099-01-01") });
assert.equal(unsupported.httpStatus, 400);
assert.equal(unsupported.response.error.code, -32004);
assert.deepEqual(unsupported.response.error.data.supported, ["2025-06-18"]);
const noClientInfo = message();
delete noClientInfo.params._meta[CLIENT_INFO_META_KEY];
assert.equal(validateSessionlessRequestMetadata({ req: goodReq, message: noClientInfo }).reason, "client_info_required");
const noCaps = message();
delete noCaps.params._meta[CLIENT_CAPABILITIES_META_KEY];
assert.equal(validateSessionlessRequestMetadata({ req: goodReq, message: noCaps }).reason, "client_capabilities_required");
const discover = dispatchSessionlessPrototypeMessage({
  message: message("server/discover"),
  requestMetadata: validateSessionlessRequestMetadata({ req: goodReq, message: message("server/discover") }),
  authContext: {},
  store: { create() {}, read() {}, destroy() {} },
  serverName: "mcp-tests-response-shape",
  serverVersion: "0.40.0",
  connectorShapeVersion: "2025-05-strict-v1",
});
assert.deepEqual(discover.result.supportedVersions, ["2025-06-18"]);
assert.equal(discover.result.protocolVersion, "2025-06-18");
assert.equal(discover.result.transport.protocol_sessions, false);
assert.equal(discover.result.serverInfo.name, "mcp-tests-response-shape");

(async () => {
  const events = [];
  const handler = createSessionlessPrototypeRouteHandler({
    env: { MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE: "1" },
    authPolicy: { requiresAuth: true, audience: "aud", authenticate: () => ({ ok: true, subject: "s", clientId: "c", scopes: ["mcp:tools"] }) },
    auditLog: (event, data) => events.push({ event, data }),
    runtimeProfile: "internal",
    publicBaseUrl: "aud",
    serverName: "mcp-tests-response-shape",
    serverVersion: "0.40.0",
    connectorShapeVersion: "2025-05-strict-v1",
  });
  const badRes = fakeRes();
  assert.equal(await handler.handleRoute({ req: req(message(), {}), res: badRes, url: new URL("http://localhost" + ROUTE_PATH) }), true);
  assert.equal(badRes.statusCode, 400);
  assert.equal(JSON.parse(badRes.body).error.data.reason, "protocol_version_header_required");
  assert.ok(events.some((item) => item.event === "sessionless_prototype_rejected" && item.data.reason === "protocol_version_header_required"));
  const okRes = fakeRes();
  assert.equal(await handler.handleRoute({ req: req(message(), { [PROTOCOL_VERSION_HEADER]: "2025-06-18" }), res: okRes, url: new URL("http://localhost" + ROUTE_PATH) }), true);
  assert.equal(okRes.statusCode, 200);
  assert.deepEqual(JSON.parse(okRes.body).result.supportedVersions, ["2025-06-18"]);
  console.log("smoke_s7_sessionless_sep2575_request_contract ok");
})().catch((error) => { console.error(error && error.stack ? error.stack : error); process.exit(1); });
