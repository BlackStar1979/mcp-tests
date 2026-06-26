"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const sfa = JSON.parse(fs.readFileSync("_workflow/state.json", "utf8"));
const cfa = String((sfa.current_work_package || {}).id || "");
const requireNoApplyAbsence = !cfa.startsWith("stage12_step38");

const manifest = JSON.parse(fs.readFileSync("_workflow/patch_manifests/stage12_step35_runtime_apply_package_preparation_no_apply.json", "utf8"));
assert.equal(manifest.status, "prepared_no_apply");
assert.equal(manifest.apply_changes_allowed, false);
assert.equal(manifest.runtime_change_authorized, false);
assert.equal(manifest.runtime_change_allowed_next, false);
assert.equal(manifest.execution_recommendation, "keep_blocked");
assert.equal(manifest.next_planned_step, "stage12_step36_decision_runtime_shim_package_no_apply");

for (const file of [
  "src/runtime/decision_runtime_context_builder.js",
  "src/runtime/decision_runtime_policy.js",
  "src/runtime/decision_runtime_receipt.js",
]) {
  if (requireNoApplyAbsence) assert.equal(fs.existsSync(file), false, `${file} must remain absent in Step 37B no-apply reconciliation`);
}

const state = JSON.parse(fs.readFileSync("_workflow/state.json", "utf8"));
const id = "stage12_step37b_decision_runtime_shim_debt_reconciliation_no_apply";
const completed = Array.isArray(state.completed_work_packages) ? state.completed_work_packages : [];
const step = state.current_work_package.id === id ? state.current_work_package : completed.find((item) => item && item.id === id);
assert.ok(step, "Step 37B must remain current or completed");
assert.equal(step.acceptance.runtime_change_authorized, false);
assert.equal(step.acceptance.runtime_apply_allowed, false);
assert.equal(step.acceptance.missing_decision_runtime_modules_confirmed, true);
assert.equal(step.acceptance.no_runtime_code_change, true);

console.log("smoke_stage12_step37b_decision_runtime_shim_debt ok");
