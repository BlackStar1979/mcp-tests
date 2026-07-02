"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const inventory = JSON.parse(read("_workflow/sessionless_inventory.json"));
const record = read("_workflow/operator_decisions/subscriptions_listen_compatibility_matrix.md");
const routeDispatcher = read("src/runtime/create_server_route_dispatcher.js");
const sseSource = read("src/runtime/mcp_get_stream_handler.js");
const notifierSource = read("src/runtime/tools_list_changed_emitter.js");

assert.ok(record.includes("Status: GREEN / DESIGN RECORDED / NO RUNTIME CHANGE"));
assert.ok(record.includes("Historical status note: this record is hidden-route transition design evidence only."));
assert.ok(record.includes("It must not be used as the current next-step plan in place of `_workflow/operator_decisions/subscriptions_listen_no_sse_project_contract.md`"));
assert.ok(record.includes("Stable `/mcp` remains the live connector target"));
assert.ok(record.includes("First implementation target must be isolated-port validation"));
assert.ok(record.includes("must not depend on `MCP-Session-Id`"));
assert.ok(record.includes("must not reintroduce `GET /mcp` or `Last-Event-ID` replay semantics"));
assert.ok(record.includes("no `subscriptions/listen` runtime implementation"));
assert.ok(record.includes("no live `notifications/tools/list_changed` emission"));

const getSse = inventory.deprecation_ledger.find((item) => item.feature_id === "get_mcp_sse_stream");
const subscriptionsListen = inventory.deprecation_ledger.find((item) => item.feature_id === "subscriptions_listen");
const replay = inventory.deprecation_ledger.find((item) => item.feature_id === "resumable_sse_last_event_id");

assert.equal(getSse.checklist.find((item) => item.item === "design subscriptions/listen compatibility matrix").status, "done");
assert.equal(getSse.checklist.find((item) => item.item === "design subscriptions/listen compatibility matrix").evidence, "_workflow/operator_decisions/subscriptions_listen_compatibility_matrix.md");
assert.equal(subscriptionsListen.implementation_status, "done");
assert.equal(subscriptionsListen.checklist.find((item) => item.item === "record compatibility matrix against stable GET /mcp SSE and list_changed dry-run").status, "done");
assert.equal(subscriptionsListen.checklist.find((item) => item.item === "test first on isolated port").status, "done");
assert.equal(replay.checklist.find((item) => item.item === "avoid new dependency on resumable SSE").status, "done");
assert.ok(inventory.recommended_next.some((item) => item.includes("State-handle fate decision is complete")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Hidden-route retirement is now live-verified on OAuth21 3008")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Historical /mcp/sessionless live-operation artifacts are quarantined")));

assert.equal(routeDispatcher.includes("/mcp/sessionless"), false);
assert.ok(sseSource.includes("getLastEventId"));
assert.ok(sseSource.includes("validateReplayRequest"));
assert.ok(notifierSource.includes('LIST_CHANGED_METHOD = "notifications/tools/list_changed"'));

console.log("smoke_subscriptions_listen_compatibility_matrix ok");
