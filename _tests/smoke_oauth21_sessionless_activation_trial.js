"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const runtimeSpec = JSON.parse(read("SERVER_RUNTIME_CONFIG_SPEC.json"));
const inventory = JSON.parse(read("_workflow/sessionless_inventory.json"));
const record = read("_workflow/operator_decisions/oauth21_sessionless_activation_trial.md");

assert.ok(record.includes("Status: GREEN / LIVE 3008 HIDDEN ROUTE ACTIVE / CONNECTOR UNCHANGED"));
assert.ok(record.includes("Historical status note: this record is hidden-route transition evidence only."));
assert.ok(record.includes("It is superseded as active target guidance by `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md`"));
assert.ok(record.includes("Do not use it as the current next-step plan."));
assert.ok(record.includes("Historical next step at that time: proceed to S10 live authenticated SEP-2575 probes on OAuth21 3008"));
assert.ok(record.includes("This is no longer the active queue; current target authority is the single-route no-SSE plan on surviving `/mcp`."));
assert.ok(record.includes("hidden `/mcp/sessionless` route"));
assert.ok(record.includes("No connector refresh"));

assert.equal(Object.hasOwn(runtimeSpec, "sessionless_prototype"), false);
assert.equal(runtimeSpec.retired_sessionless_transition.route, "/mcp/sessionless");
assert.equal(runtimeSpec.retired_sessionless_transition.env, "MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE");
assert.equal(runtimeSpec.retired_sessionless_transition.status, "retired_from_active_repo_and_live_3008");
assert.equal(fs.existsSync(path.join(ROOT, "src", "runtime", "sessionless_prototype_route_handler.js")), false);

const s9 = inventory.target_selection_readiness.s9_oauth21_3008_activation;
assert.equal(s9.status, "live_active_no_connector_change");
assert.equal(s9.route, "/mcp/sessionless");
assert.equal(s9.port, 3008);

console.log("smoke_oauth21_sessionless_activation_trial ok");
