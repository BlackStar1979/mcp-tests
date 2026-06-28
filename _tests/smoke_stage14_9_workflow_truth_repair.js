"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const json = (...parts) => JSON.parse(read(...parts));
const stateText = read("_workflow", "state.json");
const state = JSON.parse(stateText);
const readme = read("_workflow", "README.md");
const canon = read("_workflow", "WORKFLOW_CANON.md");
const index = read("_workflow", "ACTIVE_WORKFLOW_INDEX.md");
const record = read("_workflow", "operator_decisions", "stage14_9_workflow_truth_repair.md");
const inventory = json("_workflow", "sessionless_inventory.json");

assert.ok(record.includes("Status: GREEN / WORKFLOW TRUTH REPAIRED"));
assert.ok(record.includes("Every future next-step recommendation"));
assert.equal(state.status, "compact_orientation_map_not_progress_log");
assert.equal(state.source_of_operational_truth, "_workflow/WORKFLOW_CANON.md");
assert.ok(stateText.length < 15000);
for (const forbidden of ["active_planned_work", "runtime_enforcement_reconciliation", "tools_list_cache_diagnostics", "current_" + "work_" + "package", "completed_" + "work_" + "packages"]) {
  assert.equal(Object.hasOwn(state, forbidden), false);
}
assert.equal(state.next_step_recommendation_policy.blocker_reassessment_required, true);
assert.equal(state.next_step_recommendation_policy.connector_refresh_assessment_required, true);
assert.equal(state.next_step_recommendation_policy.workbench_3008_restart_assessment_required, true);
assert.equal(state.next_step_recommendation_policy.workbench_3008_restart_operator_dependency, false);
assert.equal(state.current_runtime_truth.oauth21_3008.assistant_restart_capable_when_authorized, true);
assert.equal(state.current_runtime_truth.oauth21_3008.restart_required_now, false);
assert.equal(state.current_connector_truth.oauth21_3008_tools.connector_refresh_required_now, false);
assert.equal(state.current_connector_truth.oauth21_3008_tools.connector_map_status, "in_sync_43_of_43");

assert.ok(readme.includes("## Next-step recommendation duty"));
assert.ok(readme.includes("Do not ask the operator to restart `3008`"));
assert.ok(canon.includes("Stage 14.9 workflow truth repair green"));
assert.ok(canon.includes("assistant can restart 3008 when workflow and operator intent authorize it"));
assert.ok(index.includes("stage14_9_workflow_truth_repair.md"));
assert.ok(index.includes("state.json` is only the compact machine-readable orientation map"));
const restart = inventory.deprecation_ledger.find((item) => item.feature_id === "restart_resilience");
const runtimePolicy = inventory.deprecation_ledger.find((item) => item.feature_id === "runtime_policy_scope_matrix");
assert.ok(restart.repo_current_model.includes("3008 OAuth21 is supervisor-managed"));
assert.equal(JSON.stringify(restart).includes("missing_not_recovered"), false);
assert.equal(JSON.stringify(restart).includes("live-load remains blocked"), false);
assert.equal(JSON.stringify(runtimePolicy).includes("pending restart authority"), false);
assert.equal(runtimePolicy.checklist.find((item) => item.item === "OAuth21 3008 runtime restart/load validation").status, "done");
assert.ok(inventory.recommended_next.some((item) => item.includes("reassess blockers")));
console.log("smoke_stage14_9_workflow_truth_repair ok");
