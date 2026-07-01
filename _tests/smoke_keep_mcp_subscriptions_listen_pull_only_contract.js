"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/keep_mcp_subscriptions_listen_pull_only_contract.md");
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const routeDispatcher = read("src/runtime/create_server_route_dispatcher.js");
const discoverSource = read("src/runtime/server_discover_message_handler.js");
const initSource = read("src/runtime/initialize_response.js");
const toolsListSource = read("src/runtime/tools_list_response.js");

assert.ok(record.includes("Status: GREEN / FINAL NO-SSE CONTRACT RECORDED / WORKFLOW-ONLY"));
assert.ok(record.includes("`subscriptions/listen` is not part of the end-state TEST MCP contract."));
assert.ok(record.includes("End-state tool-surface freshness is pull-only."));
assert.ok(record.includes("`ttlMs: 0`"));
assert.ok(record.includes('`cacheScope: "private"`'));
assert.ok(record.includes("Prepare the bounded runtime package that removes prototype-only `subscriptions/listen` / push debt"));

assert.equal(state.active_target_direction.subscriptions_listen_pull_only_contract_record, "_workflow/operator_decisions/keep_mcp_subscriptions_listen_pull_only_contract.md");
assert.equal(state.active_target_direction.subscriptions_listen_supported_in_end_state, false);
assert.equal(state.active_target_direction.tools_list_changed_push_supported_in_end_state, false);
assert.equal(state.active_target_direction.tool_surface_freshness_model_in_end_state, "pull_only_tools_list_ttl0_private");

assert.equal(inventory.active_target_contract.subscriptions_listen_pull_only_contract_record, "_workflow/operator_decisions/keep_mcp_subscriptions_listen_pull_only_contract.md");
assert.equal(inventory.active_target_contract.subscriptions_listen_supported_in_end_state, false);
assert.equal(inventory.active_target_contract.tools_list_changed_push_supported_in_end_state, false);
assert.equal(inventory.active_target_contract.tool_surface_freshness_model_in_end_state, "pull_only_tools_list_ttl0_private");
assert.ok(inventory.recommended_next.some((item) => item.includes("Final subscriptions/listen decision is complete")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Pull-only runtime package is complete")));

const subscriptionsListen = inventory.deprecation_ledger.find((item) => item.feature_id === "subscriptions_listen");
assert.equal(subscriptionsListen.target_lifecycle, "operator_non_target");
assert.equal(subscriptionsListen.checklist.find((item) => item.item === "record final pull-only no-SSE contract for tool-surface freshness on surviving /mcp").status, "done");
assert.equal(subscriptionsListen.checklist.find((item) => item.item === "record final pull-only no-SSE contract for tool-surface freshness on surviving /mcp").evidence, "_workflow/operator_decisions/keep_mcp_subscriptions_listen_pull_only_contract.md");

assert.ok(canon.includes("Pull-only subscriptions clarification"));
assert.ok(index.includes("keep_mcp_subscriptions_listen_pull_only_contract.md"));
assert.ok(index.includes("Execute one coherent `_tests`/`_workflow` rename-normalization migration package before any push attempt"));

assert.equal(routeDispatcher.includes("/mcp/sessionless"), false);
assert.ok(discoverSource.includes("listChanged: false"));
assert.ok(initSource.includes("listChanged: false"));
assert.ok(toolsListSource.includes("ttlMs: 0"));
assert.ok(toolsListSource.includes('cacheScope: "private"'));

console.log("smoke_keep_mcp_subscriptions_listen_pull_only_contract ok");
