"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const sfa = JSON.parse(fs.readFileSync("_workflow/state.json", "utf8"));
const cfa = String((sfa.current_work_package || {}).id || "");
const requireNoApplyAbsence = !cfa.startsWith("stage12_step38");

const manifestPath = "_workflow/patch_manifests/stage12_step37e_decision_runtime_shim_skeleton_package_no_apply.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

assert.equal(manifest.status, "skeleton_package_no_apply");
assert.equal(manifest.step, "stage12_step37e_decision_runtime_shim_skeleton_package_no_apply");
assert.equal(manifest.apply_changes_allowed, false);
assert.equal(manifest.runtime_change_authorized, false);
assert.equal(manifest.runtime_change_allowed_next, false);
assert.equal(manifest.execution_recommendation, "keep_blocked_until_operator_approval");
assert.equal(manifest.skeletons_are_templates_only, true);
assert.equal(manifest.write_runtime_files_now, false);

const expected = [
  ["src/runtime/decision_runtime_context_builder.js", "buildDecisionRuntimeContext", ["fail_closed", "redacted_summary_only", "no_raw_arguments", "no_secrets_or_tokens"]],
  ["src/runtime/decision_runtime_policy.js", "evaluateDecisionRuntimePolicy", ["explicit_allow_only", "deny_unknown_tool", "preserve_json_rpc_error_shape", "no_connector_surface_change"]],
  ["src/runtime/decision_runtime_receipt.js", "buildDecisionRuntimeReceipt", ["fail_closed", "redacted_receipt", "deterministic_shape", "no_audit_storage_change"]],
];

assert.deepEqual(manifest.planned_runtime_files_must_remain_absent, expected.map((item) => item[0]));
assert.equal(manifest.skeleton_templates.length, expected.length);

for (const [file, exported, markers] of expected) {
  if (requireNoApplyAbsence) assert.equal(fs.existsSync(file), false, `${file} must not exist in no-apply skeleton package`);
  const template = manifest.skeleton_templates.find((item) => item.file === file);
  assert.ok(template, `${file} skeleton must exist`);
  assert.equal(template.export, exported);
  assert.equal(template.template_kind, "commonjs_module_skeleton");
  for (const marker of markers) {
    assert.ok(template.required_markers.includes(marker), `${file} must include marker ${marker}`);
  }
  assert.ok(Array.isArray(template.template_outline));
  assert.ok(template.template_outline.length >= 3);
}

for (const action of [
  "do not create src/runtime/decision_runtime_context_builder.js",
  "do not create src/runtime/decision_runtime_policy.js",
  "do not create src/runtime/decision_runtime_receipt.js",
  "do not modify server.js",
  "do not restart runtime",
  "do not refresh connectors",
  "do not change connector-visible tool surface",
  "do not add CLI parameters",
]) {
  assert.ok(manifest.non_actions.includes(action), `missing non-action ${action}`);
}

const state = JSON.parse(fs.readFileSync("_workflow/state.json", "utf8"));
const id = "stage12_step37e_decision_runtime_shim_skeleton_package_no_apply";
const completed = Array.isArray(state.completed_work_packages) ? state.completed_work_packages : [];
const step = state.current_work_package.id === id ? state.current_work_package : completed.find((item) => item && item.id === id);
assert.ok(step, "Step 37E must remain current or completed");
assert.equal(step.acceptance.skeleton_package_created, true);
assert.equal(step.acceptance.no_runtime_code_change, true);
assert.equal(step.acceptance.runtime_apply_allowed, false);
assert.equal(step.acceptance.connector_visible_change_performed, false);

console.log("smoke_stage12_step37e_decision_runtime_shim_skeleton_package ok");
