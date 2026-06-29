"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  ROUTE_PATH,
  createSessionlessPrototypeRouteHandler,
  dispatchSessionlessPrototypeMessage,
  envEnabled,
} = require("../src/runtime/sessionless_prototype_route_handler");
const { createStateHandleStore, hashValue } = require("../src/runtime/state_handle_prototype");

const ROOT = path.resolve(__dirname, "..");
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }


function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(code, headers = {}) { this.statusCode = code; this.headers = headers; },
    end(chunk = "") { this.body += String(chunk || ""); },
  };
}

assert.equal(ROUTE_PATH, "/mcp/sessionless");
assert.equal(envEnabled({}), false);
assert.equal(envEnabled({ MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE: "1" }), true);
assert.equal(fs.existsSync(path.join(ROOT, "src/sessionless_target_selection_readiness.js")), false);

const runtimeSpec = JSON.parse(read("SERVER_RUNTIME_CONFIG_SPEC.json"));
assert.ok(runtimeSpec.http_routes.includes("/mcp/sessionless"));
assert.ok(runtimeSpec.env_vars.includes("MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE"));
assert.equal(runtimeSpec.sessionless_prototype.default_enabled, false);
assert.equal(runtimeSpec.sessionless_prototype.connector_surface_change, false);
assert.equal(runtimeSpec.sessionless_prototype.current_mcp_route_changed, false);

const dispatcherSource = read("src/runtime/create_server_route_dispatcher.js");
assert.ok(dispatcherSource.includes('url.pathname === "/mcp"'));
assert.ok(dispatcherSource.includes("sessionlessPrototypeRouteHandler"));
const routeSource = read("src/runtime/sessionless_prototype_route_handler.js");
assert.ok(routeSource.includes("authPolicy.requiresAuth !== true"));
assert.ok(routeSource.includes("auth_required"));

let now = 1000;
const store = createStateHandleStore({ now: () => now });
const authA = { subject: "operator", clientId: "client-a", audience: "https://mcp-tests-oauth21.romionologic.dev", profile: "internal", scopes: ["mcp:tools"] };
const authB = { subject: "operator", clientId: "client-b", audience: "https://mcp-tests-oauth21.romionologic.dev", profile: "internal", scopes: ["mcp:tools"] };

const created = store.create({ kind: "task", payload: { value: 1 }, authContext: authA, ttlMs: 1000 });
assert.match(created.handle, /^esh_/);
assert.equal(created.record.handle_id_hash, hashValue(created.handle));
assert.equal(created.record.client_id_hash, hashValue("client-a"));
assert.equal(Object.prototype.hasOwnProperty.call(created.record, "handle"), false);
assert.deepEqual(store.read({ handle: created.handle, authContext: authA, kind: "task" }).payload, { value: 1 });
assert.equal(store.read({ handle: created.handle, authContext: authB, kind: "task" }).reason, "state_handle_unauthorized");
now = 3001;
assert.equal(store.read({ handle: created.handle, authContext: authA, kind: "task" }).reason, "state_handle_expired");

const rpcStore = createStateHandleStore({ now: () => 5000 });
const discover = dispatchSessionlessPrototypeMessage({
  message: { jsonrpc: "2.0", id: 1, method: "server/discover", params: {} },
  authContext: authA,
  store: rpcStore,
  serverName: "mcp-tests-response-shape",
  serverVersion: "0.40.0",
  connectorShapeVersion: "2025-05-strict-v1",
});
assert.equal(discover.result.transport.post_only, true);
assert.equal(discover.result.transport.protocol_sessions, false);
assert.equal(discover.result.state_handles.possession_is_authorization, false);

const init = dispatchSessionlessPrototypeMessage({ message: { jsonrpc: "2.0", id: 2, method: "initialize", params: {} }, authContext: authA, store: rpcStore });
assert.equal(init.error.data.reason, "initialize_not_supported_sessionless");

const rpcCreate = dispatchSessionlessPrototypeMessage({
  message: { jsonrpc: "2.0", id: 3, method: "state/handle/create", params: { kind: "task", payload: { value: 7 } } },
  authContext: authA,
  store: rpcStore,
});
assert.match(rpcCreate.result.state_handle, /^esh_/);
assert.notEqual(JSON.stringify(rpcCreate.result.handle).includes(rpcCreate.result.state_handle), true);
const rpcRead = dispatchSessionlessPrototypeMessage({
  message: { jsonrpc: "2.0", id: 4, method: "state/handle/read", params: { kind: "task", state_handle: rpcCreate.result.state_handle } },
  authContext: authA,
  store: rpcStore,
});
assert.deepEqual(rpcRead.result.payload, { value: 7 });
const rpcDenied = dispatchSessionlessPrototypeMessage({
  message: { jsonrpc: "2.0", id: 5, method: "state/handle/read", params: { kind: "task", state_handle: rpcCreate.result.state_handle } },
  authContext: authB,
  store: rpcStore,
});
assert.equal(rpcDenied.error.data.reason, "state_handle_unauthorized");
assert.notEqual(JSON.stringify(rpcDenied).includes(rpcCreate.result.state_handle), true);

const rpcDestroy = dispatchSessionlessPrototypeMessage({
  message: { jsonrpc: "2.0", id: 6, method: "state/handle/destroy", params: { kind: "task", state_handle: rpcCreate.result.state_handle } },
  authContext: authA,
  store: rpcStore,
});
assert.equal(rpcDestroy.result.destroyed, true);
const rpcAfterDestroy = dispatchSessionlessPrototypeMessage({
  message: { jsonrpc: "2.0", id: 7, method: "state/handle/read", params: { kind: "task", state_handle: rpcCreate.result.state_handle } },
  authContext: authA,
  store: rpcStore,
});
assert.equal(rpcAfterDestroy.error.data.reason, "state_handle_revoked");

const events = JSON.parse(read("SERVER_EVENT_CATALOG_SPEC.json")).events.map((event) => event.name);
for (const event of ["sessionless_prototype_rejected", "sessionless_prototype_auth_rejected", "sessionless_prototype_parse_error", "sessionless_prototype_rpc"]) assert.ok(events.includes(event), event);


async function routeHandlerNegativeControls() {
  const url = new URL("http://localhost/mcp/sessionless");
  const disabled = createSessionlessPrototypeRouteHandler({ env: {}, authPolicy: { requiresAuth: true, authenticate: () => ({ ok: true }) } });
  assert.equal(await disabled.handleRoute({ req: { method: "GET", headers: {}, on() {} }, res: fakeRes(), url }), false);

  const enabled = createSessionlessPrototypeRouteHandler({ env: { MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE: "1" }, authPolicy: { requiresAuth: true, authenticate: () => ({ ok: true }) } });
  const getRes = fakeRes();
  assert.equal(await enabled.handleRoute({ req: { method: "GET", headers: {}, on() {} }, res: getRes, url }), true);
  assert.equal(getRes.statusCode, 405);

  const noAuth = createSessionlessPrototypeRouteHandler({ env: { MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE: "1" }, authPolicy: { requiresAuth: false, authenticate: () => ({ ok: true }) } });
  const noAuthRes = fakeRes();
  assert.equal(await noAuth.handleRoute({ req: { method: "POST", headers: {}, on() {} }, res: noAuthRes, url }), true);
  assert.equal(noAuthRes.statusCode, 403);
}

routeHandlerNegativeControls().then(() => {
  console.log("smoke_s4_sessionless_runtime_prototype ok");
}).catch((error) => { console.error(error && error.stack ? error.stack : error); process.exit(1); });
