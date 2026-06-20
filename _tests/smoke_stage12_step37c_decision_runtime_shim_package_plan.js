"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const sfa = JSON.parse(fs.readFileSync("_workflow/state.json", "utf8"));
const cfa = String((sfa.current_work_package || {}).id || "");
const requireNoApplyAbsence = !cfa.startsWith("stage12_step38");

const planPath = "_workflow/patch_manifests/stage12_step37c_decision_runtime_shim_package_plan_no_apply.json";
const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));

assert.equal(plan.status, "planned_no_apply");
assert.equal(plan.step, "stage12_step37c_decision_runtime_shim_package_plan_no_apply");
assert.equal(plan.apply_changes_allowed, false);
assert.equal(plan.runtime_change_authorized, false);
assert.equal(plan.runtime_change_allowed_next, false);
assert.equal(plan.execution_recommendation, "keep_blocked_until_operator_approval");
assert.equal(plan.source_manifest, "_workflow/patch_manifests/stage12_step35_runtime_apply_package_preparation_no_apply.json");

const expected = [
  ["src/runtime/decision_runtime_context_builder.js", "buildDecisionRuntimeContext"],
  ["src/runtime/decision_runtime_policy.js", "evaluateDecisionRuntimePolicy"],
  ["src/runtime/decision_runtime_receipt.js", "buildDecisionRuntimeReceipt"],
];

assert.equal(plan.planned_modules.length, expected.length);
for (const [file, exported] of expected) {
  const item = plan.planned_modules.find((entry) => entry.file === file);
  assert.ok(item, `${file} must be planned`);
  assert.equal(item.export, exported);
  assert.ok(Array.isArray(item.required_behavior));
  assert.ok(item.required_behavior.length >= 3);
  if (requireNoApplyAbsence) assert.equal(fs.existsSync(file), false, `${file} must not be created in this no-apply step`);
}

for (const target of [
  "src/runtime/tool_audit_helpers.js",
  "src/runtime/tools_call_handler.js",
  "src/runtime/unknown_tool_call_handler.js",
  "src/runtime/rpc_message_dispatcher.js",
]) {
  assert.ok(plan.integration_targets_after_operator_approval.includes(target), `${target} must remain post-approval only`);
}

for (const control of [
  "manifest remains apply_changes_allowed=false",
  "runtime_change_authorized=false",
  "server.js unchanged",
  "no connector refresh",
  "no runtime restart",
  "no CLI extension",
]) {
  assert.ok(plan.negative_controls_required_before_apply.includes(control), `missing control: ${control}`);
}

const state = JSON.parse(fs.readFileSync("_workflow/state.json", "utf8"));
const id = "stage12_step37c_decision_runtime_shim_package_plan_no_apply";
const completed = Array.isArray(state.completed_work_packages) ? state.completed_work_packages : [];
const step = state.current_work_package.id === id ? state.current_work_package : completed.find((item) => item && item.id === id);
assert.ok(step, "Step 37C must remain current or completed");
assert.equal(step.acceptance.no_runtime_code_change, true);
assert.equal(step.acceptance.runtime_apply_allowed, false);
assert.equal(step.acceptance.connector_visible_change_performed, false);

console.log("smoke_stage12_step37c_decision_runtime_shim_package_plan ok");
