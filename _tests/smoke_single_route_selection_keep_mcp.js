"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/single_route_selection_keep_mcp.md");
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const connectorSpec = readJson("SERVER_CONNECTOR_SURFACE_SPEC.json");
const runtimeSpec = readJson("SERVER_RUNTIME_CONFIG_SPEC.json");

assert.ok(record.includes("Status: GREEN / FINAL SURVIVING ROUTE SELECTED / WORKFLOW-ONLY"));
assert.ok(record.includes("The final surviving route is:"));
assert.ok(record.includes("- `/mcp`"));
assert.ok(record.includes("- `/mcp/sessionless`"));
assert.ok(record.includes("`/mcp/sessionless` is transition-only"));

assert.equal(state.active_target_direction.route_selection_record, "_workflow/operator_decisions/single_route_selection_keep_mcp.md");
assert.equal(state.active_target_direction.selected_surviving_route, "/mcp");

assert.equal(inventory.active_target_contract.route_selection_record, "_workflow/operator_decisions/single_route_selection_keep_mcp.md");
assert.equal(inventory.active_target_contract.selected_surviving_route, "/mcp");
assert.equal(inventory.active_target_contract.final_route_name_selected_now, true);

assert.equal(connectorSpec.oauth21_connector.path, "/mcp");
assert.equal(connectorSpec.oauth21_connector.single_route_target_selected, true);
assert.equal(connectorSpec.oauth21_connector.single_route_selection_record, "_workflow/operator_decisions/single_route_selection_keep_mcp.md");

assert.equal(runtimeSpec.retired_sessionless_transition.route, "/mcp/sessionless");
assert.equal(runtimeSpec.retired_sessionless_transition.state_handle_decision_record, "_workflow/operator_decisions/keep_mcp_state_handle_tool_pattern_decision.md");

console.log("smoke_single_route_selection_keep_mcp ok");
