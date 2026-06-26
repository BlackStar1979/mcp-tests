"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const gatePath = "_workflow/patch_manifests/stage12_step37g_decision_runtime_shim_operator_approval_gate_no_apply.json";
const gate = JSON.parse(fs.readFileSync(gatePath, "utf8"));
const runtimeFiles = [
  "src/runtime/decision_runtime_context_builder.js",
  "src/runtime/decision_runtime_policy.js",
  "src/runtime/decision_runtime_receipt.js",
];

assert.equal(gate.status, "operator_gate_no_apply");
assert.equal(gate.step, "stage12_step37g_decision_runtime_shim_operator_approval_gate_no_apply");
assert.equal(gate.candidate_apply_package.applyable_candidate, true);
assert.equal(gate.candidate_apply_package.authorized_now, false);
assert.equal(gate.candidate_apply_package.implementation_files_exist_now, false);
assert.deepEqual(gate.candidate_apply_package.candidate_files, runtimeFiles);

for (const file of runtimeFiles) {
}

const auth = gate.current_authorization;
assert.equal(auth.apply_changes_allowed, false);
assert.equal(auth.runtime_change_authorized, false);
assert.equal(auth.runtime_change_allowed_next, false);
assert.equal(auth.connector_refresh_authorized, false);
assert.equal(auth.runtime_restart_authorized, false);
assert.equal(auth.connector_visible_change_authorized, false);

const approval = new Set(gate.operator_approval_required_before_recommend_apply || []);
for (const required of [
  "explicit approval to create src/runtime/decision_runtime_context_builder.js",
  "explicit approval to create src/runtime/decision_runtime_policy.js",
  "explicit approval to create src/runtime/decision_runtime_receipt.js",
  "explicit approval to patch declared integration targets",
  "explicit rollback plan approval",
  "explicit validation plan approval",
  "explicit restart and connector refresh decision, even if expected answer is no",
]) {
  assert.ok(approval.has(required), `missing approval gate: ${required}`);
}

const policy = gate.assistant_recommendation_policy;
assert.equal(policy.must_report_applyable_candidates, true);
assert.equal(policy.must_separate_applyable_from_authorized, true);
assert.equal(policy.must_not_recommend_apply_until_gate_conditions_met, true);
assert.equal(policy.may_recommend_next_no_apply_package, true);
assert.equal(policy.next_no_apply_recommendation, "stage12_step37h_decision_runtime_shim_apply_package_dry_run_manifest_no_apply");

for (const action of [
  "do not create runtime files",
  "do not patch integration targets",
  "do not modify server.js",
  "do not restart runtime",
  "do not refresh connectors",
  "do not change connector-visible tool surface",
  "do not add CLI parameters",
]) {
  assert.ok(gate.non_actions.includes(action), `missing non-action ${action}`);
}

const state = JSON.parse(fs.readFileSync("_workflow/state.json", "utf8"));
const id = "stage12_step37g_decision_runtime_shim_operator_approval_gate_no_apply";
const completed = Array.isArray(state.completed_work_packages) ? state.completed_work_packages : [];
const step = state.current_work_package.id === id ? state.current_work_package : completed.find((item) => item && item.id === id);
assert.ok(step, "Step 37G must remain current or completed");
assert.equal(step.acceptance.applyable_candidate_reported, true);
assert.equal(step.acceptance.authorized_now, false);
assert.equal(step.acceptance.no_runtime_code_change, true);
assert.equal(step.acceptance.runtime_apply_allowed, false);

console.log("smoke_stage12_step37g_decision_runtime_shim_operator_gate ok");
