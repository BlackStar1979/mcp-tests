"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const manifestPath = "_workflow/patch_manifests/stage12_step37l_decision_runtime_shim_implementation_approval_request_no_apply.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const runtimeFiles = [
  "src/runtime/decision_runtime_context_builder.js",
  "src/runtime/decision_runtime_policy.js",
  "src/runtime/decision_runtime_receipt.js",
];
const integrationTargets = [
  "src/runtime/tools_call_handler.js",
  "src/runtime/unknown_tool_call_handler.js",
  "src/runtime/tool_audit_helpers.js",
  "src/runtime/rpc_message_dispatcher.js",
];
const requiredDecisionIds = [
  "create_runtime_files",
  "patch_integration_targets",
  "approve_validation_plan",
  "approve_rollback_plan",
  "runtime_restart_policy",
  "connector_refresh_policy",
];

assert.equal(manifest.status, "approval_request_no_apply");
assert.equal(manifest.step, "stage12_step37l_decision_runtime_shim_implementation_approval_request_no_apply");
assert.equal(manifest.applyable_candidate, true);
assert.equal(manifest.authorized_now, false);
assert.equal(manifest.apply_changes_allowed, false);
assert.equal(manifest.runtime_change_authorized, false);
assert.equal(manifest.runtime_change_allowed_next, false);
assert.equal(manifest.approval_request_only, true);

for (const file of runtimeFiles) {
}
for (const file of integrationTargets) {
  assert.equal(fs.existsSync(file), true, `${file} must exist as declared integration target`);
}

assert.equal(manifest.requested_operator_decisions.length, requiredDecisionIds.length);
for (const id of requiredDecisionIds) {
  const decision = manifest.requested_operator_decisions.find((entry) => entry.decision_id === id);
  assert.ok(decision, `${id} decision must be requested`);
  assert.equal(decision.required_for_apply, true);
  assert.ok(decision.question, `${id} must have question text`);
  assert.ok(decision.default, `${id} must have safe default`);
  assert.ok(manifest.minimum_approval_bundle_before_apply_recommendation.includes(id), `${id} must be in minimum approval bundle`);
}

const createFiles = manifest.requested_operator_decisions.find((entry) => entry.decision_id === "create_runtime_files");
assert.deepEqual(createFiles.files, runtimeFiles);
const patchTargets = manifest.requested_operator_decisions.find((entry) => entry.decision_id === "patch_integration_targets");
assert.deepEqual(patchTargets.files, integrationTargets);

for (const ref of [
  "_workflow/patch_manifests/stage12_step37j_decision_runtime_shim_implementation_package_proposal_no_apply.json",
  "_workflow/patch_manifests/stage12_step37h_decision_runtime_shim_apply_package_dry_run_manifest_no_apply.json",
  "_workflow/patch_manifests/stage12_step37g_decision_runtime_shim_operator_approval_gate_no_apply.json",
]) {
  assert.ok(manifest.proposal_refs.includes(ref), `missing proposal ref: ${ref}`);
  assert.equal(fs.existsSync(ref), true, `${ref} must exist`);
}

for (const action of [
  "do not create runtime files",
  "do not patch integration targets",
  "do not modify server.js",
  "do not restart runtime",
  "do not refresh connectors",
  "do not change connector-visible tool surface",
  "do not add CLI parameters",
]) {
  assert.ok(manifest.non_actions.includes(action), `missing non-action: ${action}`);
}

const state = JSON.parse(fs.readFileSync("_workflow/state.json", "utf8"));
const id = "stage12_step37l_decision_runtime_shim_implementation_approval_request_no_apply";
const completed = Array.isArray(state.completed_work_packages) ? state.completed_work_packages : [];
const step = state.current_work_package.id === id ? state.current_work_package : completed.find((item) => item && item.id === id);
assert.ok(step, "Step 37L must remain current or completed");
assert.equal(step.acceptance.approval_request_created, true);
assert.equal(step.acceptance.authorized_now, false);
assert.equal(step.acceptance.no_runtime_code_change, true);
assert.equal(step.acceptance.runtime_apply_allowed, false);

console.log("smoke_stage12_step37l_decision_runtime_shim_approval_request ok");
