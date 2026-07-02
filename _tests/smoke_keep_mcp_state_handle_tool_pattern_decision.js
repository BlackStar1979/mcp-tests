"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/keep_mcp_state_handle_tool_pattern_decision.md");
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const runtimeSpec = readJson("SERVER_RUNTIME_CONFIG_SPEC.json");
const stateHandleStore = read("src/runtime/state_handle_prototype.js");

assert.ok(record.includes("Status: GREEN / FINAL FATE DECIDED / WORKFLOW-ONLY"));
assert.ok(record.includes("do not survive as end-state MCP route methods on `/mcp`"));
assert.ok(record.includes("explicit state handles remain allowed as an application/tool pattern"));
assert.ok(record.includes("tool-created handles may still exist where state is unavoidable"));
assert.ok(record.includes("Prepare the bounded hidden-route retirement package now that the `state/handle/*` fate is fixed."));

assert.equal(state.active_target_direction.state_handle_tool_pattern_decision_record, "_workflow/operator_decisions/keep_mcp_state_handle_tool_pattern_decision.md");
assert.equal(state.active_target_direction.state_handle_route_methods_supported_in_end_state, false);
assert.equal(state.active_target_direction.explicit_state_handles_are_tool_pattern_only, true);

assert.equal(inventory.active_target_contract.state_handle_tool_pattern_decision_record, "_workflow/operator_decisions/keep_mcp_state_handle_tool_pattern_decision.md");
assert.equal(inventory.active_target_contract.state_handle_route_methods_supported_in_end_state, false);
assert.equal(inventory.active_target_contract.explicit_state_handles_are_tool_pattern_only, true);
assert.ok(inventory.recommended_next.some((item) => item.includes("State-handle fate decision is complete")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Hidden-route retirement is now live-verified on OAuth21 3008")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Historical /mcp/sessionless live-operation artifacts are quarantined")));

assert.ok(canon.includes("State-handle fate clarification"));
assert.ok(inventory.recommended_next.some((item) => item.includes("Repo cleanup/normalization debt is closed on main")));
assert.ok(index.includes("keep_mcp_state_handle_tool_pattern_decision.md"));
assert.ok(index.includes("Verified cleanup/normalization closeout on `main`: cleanup anchor `aecec58` remains in `main` history"));

assert.equal(runtimeSpec.retired_sessionless_transition.state_handle_decision_record, "_workflow/operator_decisions/keep_mcp_state_handle_tool_pattern_decision.md");

assert.ok(stateHandleStore.includes("function createStateHandleStore"));

console.log("smoke_keep_mcp_state_handle_tool_pattern_decision ok");
