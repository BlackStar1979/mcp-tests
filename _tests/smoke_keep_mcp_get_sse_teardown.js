"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/keep_mcp_get_sse_teardown.md");
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const runtimeSpec = readJson("SERVER_RUNTIME_CONFIG_SPEC.json");
const dispatcher = read("src/runtime/mcp_entry_dispatcher.js");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const canon = read("_workflow/WORKFLOW_CANON.md");

assert.ok(record.includes("Status: GREEN / GET SSE TEARDOWN APPLIED / RUNTIME + WORKFLOW UPDATED"));
assert.ok(record.includes("stable `GET /mcp` no longer opens an SSE stream"));
assert.ok(record.includes("stable `GET /mcp` now returns `405 Method Not Allowed`"));
assert.ok(record.includes("stable-route `Last-Event-ID` replay behavior is no longer reachable"));
assert.ok(record.includes("request-contract migration package"));

assert.equal(runtimeSpec.stable_mcp_get_policy.route, "/mcp");
assert.equal(runtimeSpec.stable_mcp_get_policy.http_method, "GET");
assert.equal(runtimeSpec.stable_mcp_get_policy.supported, false);
assert.equal(runtimeSpec.stable_mcp_get_policy.returns_method_not_allowed, true);
assert.equal(runtimeSpec.stable_mcp_get_policy.stable_sse_stream_supported, false);
assert.equal(runtimeSpec.stable_mcp_get_policy.last_event_id_replay_supported, false);
assert.equal(runtimeSpec.stable_mcp_get_policy.teardown_record, "_workflow/operator_decisions/keep_mcp_get_sse_teardown.md");

assert.equal(state.active_target_direction.get_sse_teardown_record, "_workflow/operator_decisions/keep_mcp_get_sse_teardown.md");
assert.equal(state.active_target_direction.stable_get_mcp_supported, false);
assert.equal(inventory.active_target_contract.get_sse_teardown_record, "_workflow/operator_decisions/keep_mcp_get_sse_teardown.md");
assert.equal(inventory.active_target_contract.stable_get_mcp_supported, false);

assert.equal(dispatcher.includes("handleMcpGetStream"), false);
assert.ok(index.includes("Final initialize-retirement boundary decision for the surviving `/mcp` route."));
assert.ok(index.includes("Recently completed:"));
assert.ok(canon.includes("GET teardown clarification"));

console.log("smoke_keep_mcp_get_sse_teardown ok");
