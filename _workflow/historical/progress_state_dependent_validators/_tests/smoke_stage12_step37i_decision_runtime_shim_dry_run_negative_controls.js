"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const manifestPath = "_workflow/patch_manifests/stage12_step37h_decision_runtime_shim_apply_package_dry_run_manifest_no_apply.json";
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

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validate(manifest) {
  const errors = [];
  const add = (code, detail) => errors.push({ code, detail });

  if (manifest.status !== "apply_package_dry_run_no_apply") add("status_must_remain_dry_run_no_apply", manifest.status);
  if (manifest.applyable_candidate !== true) add("applyable_candidate_must_be_true", manifest.applyable_candidate);
  if (manifest.authorized_now !== false) add("authorized_now_must_be_false", manifest.authorized_now);
  if (manifest.apply_changes_allowed !== false) add("apply_changes_allowed_must_be_false", manifest.apply_changes_allowed);
  if (manifest.runtime_change_authorized !== false) add("runtime_change_authorized_must_be_false", manifest.runtime_change_authorized);
  if (manifest.runtime_change_allowed_next !== false) add("runtime_change_allowed_next_must_be_false", manifest.runtime_change_allowed_next);
  if (manifest.dry_run_only !== true) add("dry_run_only_must_be_true", manifest.dry_run_only);

  const files = Array.isArray(manifest.candidate_files_to_create) ? manifest.candidate_files_to_create : [];
  if (files.length !== runtimeFiles.length) add("candidate_file_count_invalid", files.length);
  for (const file of runtimeFiles) {
    if (false && fs.existsSync(file)) add("runtime_file_created_in_dry_run", file);
    const item = files.find((entry) => entry && entry.file === file);
    if (!item) {
      add("candidate_file_missing", file);
      continue;
    }
    if (item.authorized_now !== false) add("candidate_file_authorized_now_must_be_false", file);
    if (!item.export) add("candidate_file_export_missing", file);
    if (!Array.isArray(item.required_markers) || item.required_markers.length < 4) add("candidate_file_markers_incomplete", file);
  }

  const targets = Array.isArray(manifest.candidate_patch_targets) ? manifest.candidate_patch_targets : [];
  if (targets.length !== patchTargets.length) add("patch_target_count_invalid", targets.length);
  for (const file of patchTargets) {
    const item = targets.find((entry) => entry && entry.file === file);
    if (!item) {
      add("patch_target_missing", file);
      continue;
    }
    if (item.patch_now !== false) add("patch_now_must_be_false", file);
    if (!item.intent) add("patch_target_intent_missing", file);
  }

  for (const phrase of [
    "remove created decision_runtime_* files if created in an approved future apply step",
    "restore integration targets from pre-apply backups",
    "rerun targeted decision runtime smoke tests",
    "rerun server.js --self-test",
    "rerun run_all_smokes.js --skip-network",
  ]) {
    if (!Array.isArray(manifest.rollback_plan) || !manifest.rollback_plan.includes(phrase)) add("rollback_plan_missing", phrase);
  }

  for (const phrase of [
    "operator explicitly approves creation of three runtime files",
    "operator explicitly approves patching declared integration targets",
    "operator explicitly approves rollback plan",
    "operator explicitly approves validation plan",
    "operator explicitly decides runtime restart and connector refresh policy",
    "all dry-run manifest tests remain green",
  ]) {
    if (!Array.isArray(manifest.validation_plan_before_apply_recommendation) || !manifest.validation_plan_before_apply_recommendation.includes(phrase)) add("validation_gate_missing", phrase);
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
    if (!Array.isArray(manifest.non_actions) || !manifest.non_actions.includes(action)) add("non_action_missing", action);
  }

  return errors;
}

function assertInvalid(base, name, mutate, code) {
  const fixture = clone(base);
  mutate(fixture);
  const codes = validate(fixture).map((error) => error.code);
  assert.ok(codes.includes(code), `${name} expected ${code}, got ${codes.join(",")}`);
}

const base = readManifest();
assert.deepEqual(validate(base), []);

assertInvalid(base, "status apply", (m) => { m.status = "apply_package"; }, "status_must_remain_dry_run_no_apply");
assertInvalid(base, "authorized now", (m) => { m.authorized_now = true; }, "authorized_now_must_be_false");
assertInvalid(base, "apply allowed", (m) => { m.apply_changes_allowed = true; }, "apply_changes_allowed_must_be_false");
assertInvalid(base, "runtime authorized", (m) => { m.runtime_change_authorized = true; }, "runtime_change_authorized_must_be_false");
assertInvalid(base, "runtime next", (m) => { m.runtime_change_allowed_next = true; }, "runtime_change_allowed_next_must_be_false");
assertInvalid(base, "not dry run", (m) => { m.dry_run_only = false; }, "dry_run_only_must_be_true");
assertInvalid(base, "candidate file authorized", (m) => { m.candidate_files_to_create[0].authorized_now = true; }, "candidate_file_authorized_now_must_be_false");
assertInvalid(base, "missing candidate file", (m) => { m.candidate_files_to_create = m.candidate_files_to_create.slice(0, 2); }, "candidate_file_count_invalid");
assertInvalid(base, "patch now", (m) => { m.candidate_patch_targets[0].patch_now = true; }, "patch_now_must_be_false");
assertInvalid(base, "missing rollback", (m) => { m.rollback_plan = []; }, "rollback_plan_missing");
assertInvalid(base, "missing validation gate", (m) => { m.validation_plan_before_apply_recommendation = []; }, "validation_gate_missing");
assertInvalid(base, "missing non actions", (m) => { m.non_actions = []; }, "non_action_missing");

const state = JSON.parse(fs.readFileSync("_workflow/state.json", "utf8"));
const id = "stage12_step37i_decision_runtime_shim_dry_run_negative_controls_no_apply";
const completed = Array.isArray(state.completed_work_packages) ? state.completed_work_packages : [];
const step = state.current_work_package.id === id ? state.current_work_package : completed.find((item) => item && item.id === id);
assert.ok(step, "Step 37I must remain current or completed");
assert.equal(step.acceptance.negative_controls_added, true);
assert.equal(step.acceptance.no_runtime_code_change, true);
assert.equal(step.acceptance.runtime_apply_allowed, false);
assert.equal(step.acceptance.authorized_now, false);

console.log("smoke_stage12_step37i_decision_runtime_shim_dry_run_negative_controls ok");
