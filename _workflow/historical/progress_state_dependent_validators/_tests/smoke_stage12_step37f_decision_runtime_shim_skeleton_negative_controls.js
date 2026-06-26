"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const sfa = JSON.parse(fs.readFileSync("_workflow/state.json", "utf8"));
const cfa = String((sfa.current_work_package || {}).id || "");
const requireNoApplyAbsence = !cfa.startsWith("stage12_step38");

const manifestPath = "_workflow/patch_manifests/stage12_step37e_decision_runtime_shim_skeleton_package_no_apply.json";
const runtimeFiles = [
  "src/runtime/decision_runtime_context_builder.js",
  "src/runtime/decision_runtime_policy.js",
  "src/runtime/decision_runtime_receipt.js",
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

  if (manifest.status !== "skeleton_package_no_apply") add("status_must_be_skeleton_package_no_apply", manifest.status);
  if (manifest.apply_changes_allowed !== false) add("apply_changes_allowed_must_be_false", manifest.apply_changes_allowed);
  if (manifest.runtime_change_authorized !== false) add("runtime_change_authorized_must_be_false", manifest.runtime_change_authorized);
  if (manifest.runtime_change_allowed_next !== false) add("runtime_change_allowed_next_must_be_false", manifest.runtime_change_allowed_next);
  if (manifest.skeletons_are_templates_only !== true) add("skeletons_must_be_templates_only", manifest.skeletons_are_templates_only);
  if (manifest.write_runtime_files_now !== false) add("write_runtime_files_now_must_be_false", manifest.write_runtime_files_now);

  if (JSON.stringify(manifest.planned_runtime_files_must_remain_absent || []) !== JSON.stringify(runtimeFiles)) {
    add("planned_absent_files_contract_invalid", manifest.planned_runtime_files_must_remain_absent);
  }

  const templates = Array.isArray(manifest.skeleton_templates) ? manifest.skeleton_templates : [];
  if (templates.length !== 3) add("skeleton_template_count_must_be_three", templates.length);

  for (const file of runtimeFiles) {
    if (requireNoApplyAbsence && fs.existsSync(file)) add("runtime_file_created_in_no_apply_step", file);
    const template = templates.find((item) => item && item.file === file);
    if (!template) {
      add("skeleton_template_missing", file);
      continue;
    }
    if (template.template_kind !== "commonjs_module_skeleton") add("template_kind_invalid", { file, actual: template.template_kind });
    if (!template.export) add("template_export_missing", file);
    const markers = new Set(template.required_markers || []);
    if (file.endsWith("context_builder.js")) {
      for (const marker of ["fail_closed", "redacted_summary_only", "no_raw_arguments", "no_secrets_or_tokens"]) if (!markers.has(marker)) add("required_marker_missing", { file, marker });
    }
    if (file.endsWith("policy.js")) {
      for (const marker of ["explicit_allow_only", "deny_unknown_tool", "preserve_json_rpc_error_shape", "no_connector_surface_change"]) if (!markers.has(marker)) add("required_marker_missing", { file, marker });
    }
    if (file.endsWith("receipt.js")) {
      for (const marker of ["fail_closed", "redacted_receipt", "deterministic_shape", "no_audit_storage_change"]) if (!markers.has(marker)) add("required_marker_missing", { file, marker });
    }
  }

  const nonActions = new Set(manifest.non_actions || []);
  for (const item of [
    "do not create src/runtime/decision_runtime_context_builder.js",
    "do not create src/runtime/decision_runtime_policy.js",
    "do not create src/runtime/decision_runtime_receipt.js",
    "do not modify server.js",
    "do not restart runtime",
    "do not refresh connectors",
    "do not change connector-visible tool surface",
    "do not add CLI parameters",
  ]) {
    if (!nonActions.has(item)) add("non_action_missing", item);
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

assertInvalid(base, "apply enabled", (m) => { m.apply_changes_allowed = true; }, "apply_changes_allowed_must_be_false");
assertInvalid(base, "runtime authorized", (m) => { m.runtime_change_authorized = true; }, "runtime_change_authorized_must_be_false");
assertInvalid(base, "write runtime files", (m) => { m.write_runtime_files_now = true; }, "write_runtime_files_now_must_be_false");
assertInvalid(base, "templates not templates", (m) => { m.skeletons_are_templates_only = false; }, "skeletons_must_be_templates_only");
assertInvalid(base, "missing absent file contract", (m) => { m.planned_runtime_files_must_remain_absent = m.planned_runtime_files_must_remain_absent.slice(0, 2); }, "planned_absent_files_contract_invalid");
assertInvalid(base, "missing template", (m) => { m.skeleton_templates = m.skeleton_templates.slice(0, 2); }, "skeleton_template_count_must_be_three");
assertInvalid(base, "bad template kind", (m) => { m.skeleton_templates[0].template_kind = "runtime_file"; }, "template_kind_invalid");
assertInvalid(base, "missing export", (m) => { delete m.skeleton_templates[0].export; }, "template_export_missing");
assertInvalid(base, "missing marker", (m) => { m.skeleton_templates[0].required_markers = []; }, "required_marker_missing");
assertInvalid(base, "missing non action", (m) => { m.non_actions = []; }, "non_action_missing");

const state = JSON.parse(fs.readFileSync("_workflow/state.json", "utf8"));
const id = "stage12_step37f_decision_runtime_shim_skeleton_negative_controls_no_apply";
const completed = Array.isArray(state.completed_work_packages) ? state.completed_work_packages : [];
const step = state.current_work_package.id === id ? state.current_work_package : completed.find((item) => item && item.id === id);
assert.ok(step, "Step 37F must remain current or completed");
assert.equal(step.acceptance.negative_controls_added, true);
assert.equal(step.acceptance.no_runtime_code_change, true);
assert.equal(step.acceptance.runtime_apply_allowed, false);
assert.equal(step.acceptance.connector_visible_change_performed, false);

console.log("smoke_stage12_step37f_decision_runtime_shim_skeleton_negative_controls ok");
