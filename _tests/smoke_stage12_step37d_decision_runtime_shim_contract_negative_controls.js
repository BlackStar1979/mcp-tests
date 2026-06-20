"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const sfa = JSON.parse(fs.readFileSync("_workflow/state.json", "utf8"));
const cfa = String((sfa.current_work_package || {}).id || "");
const requireNoApplyAbsence = !cfa.startsWith("stage12_step38");

const planPath = "_workflow/patch_manifests/stage12_step37c_decision_runtime_shim_package_plan_no_apply.json";
const expectedModules = [
  "src/runtime/decision_runtime_context_builder.js",
  "src/runtime/decision_runtime_policy.js",
  "src/runtime/decision_runtime_receipt.js",
];

function readPlan() {
  return JSON.parse(fs.readFileSync(planPath, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validate(plan) {
  const errors = [];
  function add(code, detail) { errors.push({ code, detail }); }

  if (plan.status !== "planned_no_apply") add("status_must_be_planned_no_apply", plan.status);
  if (plan.apply_changes_allowed !== false) add("apply_changes_allowed_must_be_false", plan.apply_changes_allowed);
  if (plan.runtime_change_authorized !== false) add("runtime_change_authorized_must_be_false", plan.runtime_change_authorized);
  if (plan.runtime_change_allowed_next !== false) add("runtime_change_allowed_next_must_be_false", plan.runtime_change_allowed_next);
  if (plan.execution_recommendation !== "keep_blocked_until_operator_approval") add("execution_must_remain_blocked", plan.execution_recommendation);

  const modules = Array.isArray(plan.planned_modules) ? plan.planned_modules : [];
  if (modules.length !== 3) add("planned_modules_count_must_be_three", modules.length);
  for (const file of expectedModules) {
    const item = modules.find((entry) => entry && entry.file === file);
    if (!item) {
      add("planned_module_missing", file);
      continue;
    }
    if (!item.export) add("planned_module_export_missing", file);
    const text = JSON.stringify(item.required_behavior || []);
    if (!text.includes("fail closed") && !text.includes("malformed")) add("fail_closed_behavior_missing", file);
    if (!text.includes("raw arguments") && !text.includes("secrets")) add("redaction_behavior_missing", file);
  }

  const controls = new Set(plan.negative_controls_required_before_apply || []);
  for (const control of [
    "manifest remains apply_changes_allowed=false",
    "runtime_change_authorized=false",
    "server.js unchanged",
    "no connector refresh",
    "no runtime restart",
    "no CLI extension",
  ]) {
    if (!controls.has(control)) add("negative_control_missing", control);
  }

  for (const file of expectedModules) {
    if (requireNoApplyAbsence && fs.existsSync(file)) add("runtime_module_created_in_no_apply_step", file);
  }

  return errors;
}

function assertInvalid(base, name, mutate, code) {
  const plan = clone(base);
  mutate(plan);
  const codes = validate(plan).map((error) => error.code);
  assert.ok(codes.includes(code), `${name} expected ${code}, got ${codes.join(",")}`);
}

const base = readPlan();
assert.deepEqual(validate(base), []);

assertInvalid(base, "apply flag", (p) => { p.apply_changes_allowed = true; }, "apply_changes_allowed_must_be_false");
assertInvalid(base, "runtime authorization", (p) => { p.runtime_change_authorized = true; }, "runtime_change_authorized_must_be_false");
assertInvalid(base, "next runtime change", (p) => { p.runtime_change_allowed_next = true; }, "runtime_change_allowed_next_must_be_false");
assertInvalid(base, "execution unblock", (p) => { p.execution_recommendation = "apply_next"; }, "execution_must_remain_blocked");
assertInvalid(base, "missing module", (p) => { p.planned_modules = p.planned_modules.slice(0, 2); }, "planned_modules_count_must_be_three");
assertInvalid(base, "missing export", (p) => { delete p.planned_modules[0].export; }, "planned_module_export_missing");
assertInvalid(base, "missing behavior", (p) => { p.planned_modules[0].required_behavior = []; }, "fail_closed_behavior_missing");
assertInvalid(base, "missing control", (p) => { p.negative_controls_required_before_apply = []; }, "negative_control_missing");

const state = JSON.parse(fs.readFileSync("_workflow/state.json", "utf8"));
const id = "stage12_step37d_decision_runtime_shim_contract_negative_controls_no_apply";
const completed = Array.isArray(state.completed_work_packages) ? state.completed_work_packages : [];
const step = state.current_work_package.id === id ? state.current_work_package : completed.find((item) => item && item.id === id);
assert.ok(step, "Step 37D must remain current or completed");
assert.equal(step.acceptance.no_runtime_code_change, true);
assert.equal(step.acceptance.runtime_apply_allowed, false);
assert.equal(step.acceptance.negative_controls_added, true);

console.log("smoke_stage12_step37d_decision_runtime_shim_contract_negative_controls ok");
