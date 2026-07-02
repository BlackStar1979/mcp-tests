"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const runtimeSpec = JSON.parse(read("SERVER_RUNTIME_CONFIG_SPEC.json"));
const inventory = JSON.parse(read("_workflow/sessionless_inventory.json"));
const record = read("_workflow/operator_decisions/sessionless_sep2575_request_contract.md");
const discoverSource = read("src/runtime/server_discover_message_handler.js");
const dispatcherSource = read("src/runtime/create_server_route_dispatcher.js");

assert.ok(record.includes("Status: GREEN / RUNTIME PATCH ON HIDDEN ROUTE / CONNECTOR UNCHANGED"));
assert.ok(record.includes("Historical status note: this record is hidden-route transition evidence only."));
assert.ok(record.includes("It is superseded as active target guidance by `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md`"));
assert.ok(record.includes("Do not use it as the current next-step plan."));
assert.ok(record.includes("Historical next step at that time: proceed to an isolated S8 sessionless activation/regression run on a higher local port"));
assert.ok(record.includes("This is no longer the active queue; current target authority is the single-route no-SSE plan on surviving `/mcp`."));
assert.ok(record.includes("`/mcp/sessionless`"));
assert.ok(record.includes("MCP-Protocol-Version"));
assert.ok(record.includes("server/discover"));

assert.equal(Object.hasOwn(runtimeSpec, "sessionless_prototype"), false);
assert.equal(runtimeSpec.retired_sessionless_transition.historical_request_contract_record, "_workflow/operator_decisions/sessionless_sep2575_request_contract.md");
assert.equal(dispatcherSource.includes("/mcp/sessionless"), false);
assert.ok(discoverSource.includes("protocol_sessions: true"));

const s7 = inventory.target_selection_readiness.s7_sep2575_request_contract;
assert.equal(s7.status, "runtime_enforced_on_hidden_route_no_connector_change");
assert.equal(s7.guard, "_tests/smoke_sessionless_sep2575_request_contract.js");

console.log("smoke_sessionless_sep2575_request_contract ok");
