"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const manifestPath = "_workflow/patch_manifests/stage12_step37h_decision_runtime_shim_apply_package_dry_run_manifest_no_apply.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const runtimeFiles = [
  "src/runtime/decision_runtime_context_builder.js",
  "src/runtime/decision_runtime_policy.js",
  "src/runtime/decision_runtime_receipt.js",
];
const patchTargets = [
  "src/runtime/tool_audit_helpers.js",
  "src/runtime/tools_call_handler.js",
  "src/runtime/unknown_tool_call_handler.js",
  "src/runtime/rpc_message_dispatcher.js",
];

assert.equal(manifest.status, "apply_package_dry_run_no_apply");
assert.equal(manifest.step, "stage12_step37h_decision_runtime_shim_apply_package_dry_run_manifest_no_apply");
assert.equal(manifest.applyable_candidate, true);
assert.equal(manifest.authorized_now, false);
assert.equal(manifest.apply_changes_allowed, false);
assert.equal(manifest.runtime_change_authorized, false);
assert.equal(manifest.runtime_change_allowed_next, false);
assert.equal(manifest.dry_run_only, true);

assert.equal(manifest.candidate_files_to_create.length, runtimeFiles.length);
for (const file of runtimeFiles) {
  const item = manifest.candidate_files_to_create.find((entry) => entry.file === file);
  assert.ok(item, `${file} must be listed as candidate file`);
  assert.equal(item.authorized_now, false);
  assert.ok(item.export, `${file} must specify export`);
  assert.ok(Array.isArray(item.required_markers));
  assert.ok(item.required_markers.length >= 4);
}

assert.equal(manifest.candidate_patch_targets.length, patchTargets.length);
for (const file of patchTargets) {
  assert.equal(fs.existsSync(file), true, `${file} must exist as an integration target`);
  const item = manifest.candidate_patch_targets.find((entry) => entry.file === file);
  assert.ok(item, `${file} must be listed as candidate patch target`);
  assert.equal(item.patch_now, false);
  assert.ok(item.intent);
}

for (const phrase of [
  "remove created decision_runtime_* files if created in an approved future apply step",
  "restore integration targets from pre-apply backups",
  "rerun targeted decision runtime smoke tests",
  "rerun server.js --self-test",
  "rerun run_all_smokes.js --skip-network",
]) {
  assert.ok(manifest.rollback_plan.includes(phrase), `missing rollback step: ${phrase}`);
}

for (const phrase of [
  "operator explicitly approves creation of three runtime files",
  "operator explicitly approves patching declared integration targets",
  "operator explicitly approves rollback plan",
  "operator explicitly approves validation plan",
  "operator explicitly decides runtime restart and connector refresh policy",
  "all dry-run manifest tests remain green",
]) {
  assert.ok(manifest.validation_plan_before_apply_recommendation.includes(phrase), `missing validation gate: ${phrase}`);
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
const id = "stage12_step37h_decision_runtime_shim_apply_package_dry_run_manifest_no_apply";
const completed = Array.isArray(state.completed_work_packages) ? state.completed_work_packages : [];
const step = state.current_work_package.id === id ? state.current_work_package : completed.find((item) => item && item.id === id);
assert.ok(step, "Step 37H must remain current or completed");
assert.equal(step.acceptance.applyable_candidate_reported, true);
assert.equal(step.acceptance.authorized_now, false);
assert.equal(step.acceptance.dry_run_manifest_created, true);
assert.equal(step.acceptance.no_runtime_code_change, true);
assert.equal(step.acceptance.runtime_apply_allowed, false);

console.log("smoke_stage12_step37h_decision_runtime_shim_apply_package_dry_run ok");
