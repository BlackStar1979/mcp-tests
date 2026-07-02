"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/keep_mcp_pull_only_tool_surface_freshness_runtime_package.md");
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const runtimeSpec = readJson("SERVER_RUNTIME_CONFIG_SPEC.json");
const eventSpec = readJson("SERVER_EVENT_CATALOG_SPEC.json");
const bootstrap = read("src/runtime/server_bootstrap_runtime.js");
const dispatcher = read("src/runtime/rpc_message_dispatcher.js");
const routeDispatcher = read("src/runtime/create_server_route_dispatcher.js");
const initSource = read("src/runtime/initialize_response.js");
const discoverSource = read("src/runtime/server_discover_message_handler.js");
const toolsListSource = read("src/runtime/tools_list_response.js");

assert.ok(record.includes("Status: GREEN / RUNTIME + WORKFLOW UPDATED / RESTART NOT YET PERFORMED"));
assert.ok(record.includes("surviving `/mcp` no longer advertises `capabilities.tools.listChanged`"));
assert.ok(record.includes("hidden `/mcp/sessionless` no longer implements `subscriptions/listen`"));
assert.ok(record.includes("restart_required_now: true"));
assert.ok(record.includes("Prepare the final `state/handle/*` fate decision required before hidden `/mcp/sessionless` retirement."));

assert.equal(state.active_target_direction.pull_only_tool_surface_freshness_runtime_package_record, "_workflow/operator_decisions/keep_mcp_pull_only_tool_surface_freshness_runtime_package.md");
assert.equal(state.active_target_direction.stable_list_changed_capability_advertised_now, false);
assert.equal(state.active_target_direction.sessionless_prototype_subscriptions_listen_active_now, false);
assert.equal(state.current_runtime_truth.oauth21_3008.restart_required_now, false);
assert.equal(state.current_runtime_truth.oauth21_3008.sessionless_hidden_route_subscriptions_listen_active, false);

assert.equal(inventory.active_target_contract.pull_only_tool_surface_freshness_runtime_package_record, "_workflow/operator_decisions/keep_mcp_pull_only_tool_surface_freshness_runtime_package.md");
assert.equal(inventory.active_target_contract.stable_list_changed_capability_advertised_now, false);
assert.equal(inventory.active_target_contract.sessionless_prototype_subscriptions_listen_active_now, false);
assert.ok(inventory.recommended_next.some((item) => item.includes("Pull-only runtime package is complete")));
assert.ok(inventory.recommended_next.some((item) => item.includes("State-handle fate decision is complete")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Hidden-route retirement is now live-verified on OAuth21 3008")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Historical /mcp/sessionless live-operation artifacts are quarantined")));

const subscriptionsListen = inventory.deprecation_ledger.find((item) => item.feature_id === "subscriptions_listen");
assert.equal(subscriptionsListen.implementation_status, "done");
assert.equal(subscriptionsListen.checklist.find((item) => item.item === "retire prototype-only subscriptions/listen runtime path and stop advertising tool-list push on active /mcp").status, "done");
assert.equal(subscriptionsListen.checklist.find((item) => item.item === "retire prototype-only subscriptions/listen runtime path and stop advertising tool-list push on active /mcp").evidence, "_workflow/operator_decisions/keep_mcp_pull_only_tool_surface_freshness_runtime_package.md");

assert.ok(canon.includes("Pull-only runtime-package clarification"));
assert.ok(index.includes("keep_mcp_pull_only_tool_surface_freshness_runtime_package.md"));
assert.ok(index.includes("Verified cleanup/normalization closeout on `main`: `origin/main` and local `main` are at `aecec58`"));

assert.equal(bootstrap.includes("createToolsListChangedNotifier"), false);
assert.equal(dispatcher.includes("listChangedNotifier"), false);
assert.equal(routeDispatcher.includes("/mcp/sessionless"), false);
assert.ok(initSource.includes("listChanged: false"));
assert.ok(discoverSource.includes("listChanged: false"));
assert.ok(toolsListSource.includes("ttlMs: 0"));
assert.ok(toolsListSource.includes('cacheScope: "private"'));
assert.equal(runtimeSpec.stable_mcp_request_contract_bridge.tools_list_changed_capability_advertised, false);
assert.equal(runtimeSpec.retired_sessionless_transition.status, "retired_from_active_repo_and_live_3008");
const listChangedEvent = eventSpec.events.find((item) => item.name === "tools_list_changed_emitted");
assert.ok(listChangedEvent);
assert.equal(listChangedEvent.status, "active_code_event_runtime_path_present_but_live_emission_disabled_now");

console.log("smoke_keep_mcp_pull_only_tool_surface_freshness_runtime_package ok");
