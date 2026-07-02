"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

const record = read("_workflow/operator_decisions/subscriptions_listen_isolated_validation.md");
const inventory = readJson("_workflow/sessionless_inventory.json");
const runtimeSpec = readJson("SERVER_RUNTIME_CONFIG_SPEC.json");
const routeDispatcher = read("src/runtime/create_server_route_dispatcher.js");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const toolsListChangedEmitterPath = path.join(ROOT, "src/runtime/tools_list_changed_emitter.js");

assert.ok(record.includes("Status: GREEN / ISOLATED HIGHER-PORT VALIDATION PASSED / STABLE ROUTE UNCHANGED"));
assert.ok(record.includes("This record is historical transition-debt evidence only."));
assert.ok(record.includes("Historical status note: this record is hidden-route transition evidence only."));
assert.ok(record.includes("It is superseded as active target guidance by `_workflow/operator_decisions/subscriptions_listen_no_sse_project_contract.md`"));
assert.ok(record.includes("Do not use it as the current next-step plan."));
assert.ok(record.includes("Historical next step at that time: treat the SSE-based implementation as transitional migration debt and define the single-route, no-SSE, streamable-HTTP target contract and migration plan."));
assert.ok(record.includes("This record is no longer an active instruction source; the current target authority remains the single-route no-SSE plan on surviving `/mcp`."));
assert.ok(record.includes("route: `/mcp/sessionless`"));
assert.ok(record.includes("transport: POST request-scoped SSE stream"));
assert.ok(record.includes("notifications/tools/list_changed"));
assert.ok(record.includes("stable `/mcp` behavior was not changed"));

const subscriptionsListen = inventory.deprecation_ledger.find((item) => item.feature_id === "subscriptions_listen");
assert.equal(subscriptionsListen.implementation_status, "done");
assert.equal(subscriptionsListen.checklist.find((item) => item.item === "test first on isolated port").status, "done");
assert.equal(subscriptionsListen.checklist.find((item) => item.item === "test first on isolated port").evidence, "_workflow/operator_decisions/subscriptions_listen_isolated_validation.md");

const readiness = inventory.target_selection_readiness.subscriptions_listen_isolated_validation;
assert.equal(readiness.status, "passed_ephemeral_higher_port_no_stable_route_change");
assert.equal(readiness.record, "_workflow/operator_decisions/subscriptions_listen_isolated_validation.md");
assert.equal(readiness.guard, "_tests/smoke_subscriptions_listen_isolated_validation.js");
assert.equal(readiness.transitional_request_scoped_sse_only, true);
assert.equal(readiness.connector_refresh_required_now, false);
assert.equal(readiness.runtime_restart_required_now, false);
assert.equal(readiness.public_3009_start_required_now, false);
assert.equal(readiness.stable_mcp_changed, false);

assert.equal(runtimeSpec.http_routes.includes("/mcp/sessionless"), false);
assert.equal(Object.hasOwn(runtimeSpec, "sessionless_prototype"), false);
assert.equal(routeDispatcher.includes("/mcp/sessionless"), false);
assert.equal(fs.existsSync(toolsListChangedEmitterPath), false);

assert.ok(canon.includes("`subscriptions/listen` isolated validation green"));
assert.ok(canon.includes("transitional migration debt rather than the final target"));
assert.ok(index.includes("subscriptions_listen_isolated_validation.md"));
assert.ok(index.includes("The current `/mcp/sessionless` listener remains transition-only evidence, not the target design."));

console.log("smoke_subscriptions_listen_isolated_validation ok");
