"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md");
const inventory = readJson("_workflow/sessionless_inventory.json");
const state = readJson("_workflow/state.json");

assert.ok(record.includes("Status: GREEN / TARGET CONTRACT AND MIGRATION PLAN RECORDED / WORKFLOW-ONLY"));
assert.ok(record.includes("one MCP route only"));
assert.ok(record.includes("no SSE"));
assert.ok(record.includes("The final surviving route is selected separately in"));
assert.ok(record.includes("The selected surviving route is `/mcp`"));
assert.ok(record.includes("`GET /mcp` SSE"));
assert.ok(record.includes("`MCP-Session-Id`"));

assert.equal(inventory.active_target_contract.record, "_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md");
assert.equal(inventory.active_target_contract.route_selection_record, "_workflow/operator_decisions/single_route_selection_keep_mcp.md");
assert.equal(inventory.active_target_contract.migration_debt_inventory_record, "_workflow/operator_decisions/single_route_no_sse_migration_debt_inventory.md");
assert.equal(inventory.active_target_contract.single_route_only, true);
assert.equal(inventory.active_target_contract.selected_surviving_route, "/mcp");
assert.equal(inventory.active_target_contract.sse_allowed_in_end_state, false);
assert.equal(inventory.active_target_contract.final_route_name_selected_now, true);

assert.equal(state.active_target_direction.decision_record, "_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md");
assert.equal(state.active_target_direction.route_selection_record, "_workflow/operator_decisions/single_route_selection_keep_mcp.md");
assert.equal(state.active_target_direction.migration_debt_inventory_record, "_workflow/operator_decisions/single_route_no_sse_migration_debt_inventory.md");
assert.equal(state.active_target_direction.selected_surviving_route, "/mcp");
assert.equal(state.active_target_direction.dual_route_coexistence_is_target, false);

console.log("smoke_single_route_no_sse_target_plan ok");
