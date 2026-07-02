"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/subscriptions_listen_no_sse_project_contract.md");
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const routeDispatcher = read("src/runtime/create_server_route_dispatcher.js");
const notifierSource = read("src/runtime/tools_list_changed_emitter.js");
const dryRunSource = read("src/list_changed_notification_bus.js");

assert.ok(record.includes("Status: GREEN / SOURCE-BOUND PROJECT CONTRACT RECORDED / WORKFLOW-ONLY"));
assert.ok(record.includes("no SSE at all"));
assert.ok(record.includes("not a generic MCP requirement"));
assert.ok(record.includes("stricter TEST MCP project policy"));
assert.ok(record.includes("surviving route: `/mcp`"));
assert.ok(record.includes("hidden `/mcp/sessionless` is transition-only debt"));
assert.ok(record.includes("must not use request-scoped SSE in the final project design"));
assert.ok(record.includes("Do not guess these points"));
assert.ok(record.includes("SEP-2549 `ttlMs` / `cacheScope` inventory"));

assert.equal(state.active_target_direction.subscriptions_listen_no_sse_project_contract_record, "_workflow/operator_decisions/subscriptions_listen_no_sse_project_contract.md");
assert.equal(inventory.active_target_contract.subscriptions_listen_no_sse_project_contract_record, "_workflow/operator_decisions/subscriptions_listen_no_sse_project_contract.md");
assert.equal(inventory.recommended_next.some((item) => item.includes("SEP-2549 TTL/cacheScope list freshness")), false);

const subscriptionsListen = inventory.deprecation_ledger.find((item) => item.feature_id === "subscriptions_listen");
assert.equal(subscriptionsListen.checklist.find((item) => item.item === "record stricter no-SSE project contract boundary").status, "done");
assert.equal(subscriptionsListen.checklist.find((item) => item.item === "record stricter no-SSE project contract boundary").evidence, "_workflow/operator_decisions/subscriptions_listen_no_sse_project_contract.md");

assert.ok(canon.includes("No-SSE subscriptions/listen clarification"));
assert.ok(canon.includes("current official MCP Streamable HTTP direction still allows request-scoped SSE"));
assert.ok(index.includes("subscriptions_listen_no_sse_project_contract.md"));
assert.ok(index.includes("Verified cleanup/normalization closeout on `main`: cleanup anchor `aecec58` remains in `main` history"));

assert.equal(routeDispatcher.includes("/mcp/sessionless"), false);
assert.ok(notifierSource.includes("LIST_CHANGED_METHOD"));
assert.ok(dryRunSource.includes("dry-run only"));

console.log("smoke_subscriptions_listen_no_sse_project_contract ok");
