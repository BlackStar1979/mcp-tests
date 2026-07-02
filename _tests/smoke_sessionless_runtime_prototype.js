"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createStateHandleStore, hashValue } = require("../src/runtime/state_handle_prototype");

const ROOT = path.resolve(__dirname, "..");
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }

const runtimeSpec = JSON.parse(read("SERVER_RUNTIME_CONFIG_SPEC.json"));
const eventSpec = JSON.parse(read("SERVER_EVENT_CATALOG_SPEC.json"));
const state = JSON.parse(read("_workflow/state.json"));
const dispatcherSource = read("src/runtime/create_server_route_dispatcher.js");
const bootstrapSource = read("src/runtime/server_bootstrap_runtime.js");
const record = read("_workflow/operator_decisions/sessionless_runtime_prototype.md");

assert.ok(record.includes("Historical status note: this record is hidden-route transition evidence only."));
assert.ok(record.includes("It is superseded as active target guidance by `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md`"));
assert.ok(record.includes("Do not use it as the current next-step plan."));

assert.equal(fs.existsSync(path.join(ROOT, "src", "runtime", "sessionless_prototype_route_handler.js")), false);
assert.equal(runtimeSpec.http_routes.includes("/mcp/sessionless"), false);
assert.equal(runtimeSpec.env_vars.includes("MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE"), false);
assert.equal(Object.hasOwn(runtimeSpec, "sessionless_prototype"), false);
assert.equal(runtimeSpec.retired_sessionless_transition.status, "retired_from_active_repo_and_live_3008");
assert.equal(runtimeSpec.retired_sessionless_transition.historical_only, true);
assert.equal(dispatcherSource.includes('url.pathname === "/mcp/sessionless"'), false);
assert.equal(bootstrapSource.includes("createSessionlessPrototypeRouteHandler"), false);
assert.equal(bootstrapSource.includes("sessionlessPrototypeRouteHandler"), false);

for (const name of ["sessionless_prototype_rejected", "sessionless_prototype_auth_rejected", "sessionless_prototype_parse_error", "sessionless_prototype_rpc"]) {
  assert.equal(eventSpec.events.some((event) => event.name === name), false, name);
}

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
const rpcCreate = rpcStore.create({ kind: "task", payload: { value: 7 }, authContext: authA });
const rpcRead = rpcStore.read({ handle: rpcCreate.handle, authContext: authA, kind: "task" });
assert.deepEqual(rpcRead.payload, { value: 7 });
const rpcDenied = rpcStore.read({ handle: rpcCreate.handle, authContext: authB, kind: "task" });
assert.equal(rpcDenied.reason, "state_handle_unauthorized");
const rpcDestroy = rpcStore.destroy({ handle: rpcCreate.handle, authContext: authA, kind: "task" });
assert.equal(rpcDestroy.ok, true);
const rpcAfterDestroy = rpcStore.read({ handle: rpcCreate.handle, authContext: authA, kind: "task" });
assert.equal(rpcAfterDestroy.reason, "state_handle_revoked");

assert.equal(state.current_runtime_truth.oauth21_3008.restart_required_now, false);
assert.equal(state.current_runtime_truth.oauth21_3008.sessionless_hidden_route_active, false);
assert.equal(state.current_runtime_truth.oauth21_3008.sessionless_hidden_route_repo_retired_now, true);

console.log("smoke_sessionless_runtime_prototype ok");
