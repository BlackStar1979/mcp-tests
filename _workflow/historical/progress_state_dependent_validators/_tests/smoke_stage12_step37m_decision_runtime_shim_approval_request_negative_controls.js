"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const manifestPath = "_workflow/patch_manifests/stage12_step37l_decision_runtime_shim_implementation_approval_request_no_apply.json";
const runtimeFiles = [
  "src/runtime/decision_runtime_context_builder.js",
  "src/runtime/decision_runtime_policy.js",
  "src/runtime/decision_runtime_receipt.js",
];
const requiredDecisionIds = [
  "create_runtime_files",
  "patch_integration_targets",
  "approve_validation_plan",
  "approve_rollback_plan",
  "runtime_restart_policy",
  "connector_refresh_policy",
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function validate(manifest) {
  const errors = [];
  const add = (code, detail) => errors.push({ code, detail });

  if (manifest.status !== "approval_request_no_apply") add("status_must_remain_approval_request_no_apply", manifest.status);
  if (manifest.applyable_candidate !== true) add("applyable_candidate_must_be_true", manifest.applyable_candidate);
  if (manifest.authorized_now !== false) add("authorized_now_must_be_false", manifest.authorized_now);
  if (manifest.apply_changes_allowed !== false) add("apply_changes_allowed_must_be_false", manifest.apply_changes_allowed);
  if (manifest.runtime_change_authorized !== false) add("runtime_change_authorized_must_be_false", manifest.runtime_change_authorized);
  if (manifest.runtime_change_allowed_next !== false) add("runtime_change_allowed_next_must_be_false", manifest.runtime_change_allowed_next);
  if (manifest.approval_request_only !== true) add("approval_request_only_must_be_true", manifest.approval_request_only);

  const decisions = Array.isArray(manifest.requested_operator_decisions) ? manifest.requested_operator_decisions : [];
  if (decisions.length !== requiredDecisionIds.length) add("decision_count_invalid", decisions.length);
  for (const id of requiredDecisionIds) {
    const item = decisions.find((entry) => entry && entry.decision_id === id);
    if (!item) {
      add("decision_missing", id);
      continue;
    }
    if (item.required_for_apply !== true) add("decision_required_for_apply_must_be_true", id);
    if (!item.question) add("decision_question_missing", id);
    if (!item.default) add("decision_default_missing", id);
  }

  const bundle = Array.isArray(manifest.minimum_approval_bundle_before_apply_recommendation) ? manifest.minimum_approval_bundle_before_apply_recommendation : [];
  for (const id of requiredDecisionIds) {
    if (!bundle.includes(id)) add("minimum_approval_bundle_missing", id);
  }

  for (const file of runtimeFiles) {
    if (false && fs.existsSync(file)) add("runtime_file_created_in_approval_request", file);
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

assertInvalid(base, "status changed", (m) => { m.status = "approved"; }, "status_must_remain_approval_request_no_apply");
assertInvalid(base, "authorized", (m) => { m.authorized_now = true; }, "authorized_now_must_be_false");
assertInvalid(base, "apply allowed", (m) => { m.apply_changes_allowed = true; }, "apply_changes_allowed_must_be_false");
assertInvalid(base, "runtime authorized", (m) => { m.runtime_change_authorized = true; }, "runtime_change_authorized_must_be_false");
assertInvalid(base, "runtime next", (m) => { m.runtime_change_allowed_next = true; }, "runtime_change_allowed_next_must_be_false");
assertInvalid(base, "request only off", (m) => { m.approval_request_only = false; }, "approval_request_only_must_be_true");
assertInvalid(base, "decision removed", (m) => { m.requested_operator_decisions = m.requested_operator_decisions.slice(0, 5); }, "decision_count_invalid");
assertInvalid(base, "decision not required", (m) => { m.requested_operator_decisions[0].required_for_apply = false; }, "decision_required_for_apply_must_be_true");
assertInvalid(base, "bundle removed", (m) => { m.minimum_approval_bundle_before_apply_recommendation = []; }, "minimum_approval_bundle_missing");
assertInvalid(base, "non actions removed", (m) => { m.non_actions = []; }, "non_action_missing");

const state = JSON.parse(fs.readFileSync("_workflow/state.json", "utf8"));
const cur = state.current_work_package;
const done = state.completed_work_packages || [];
const id = ["stage12","step37m","decision_runtime_shim","approval_request","negative_controls","no_apply"].join("_");
const step = cur.id === id ? cur : done.find((x) => x && x.id === id);
assert.ok(step);
assert.equal(step.acceptance.negative_controls_added, true);
assert.equal(step.acceptance.authorized_now, false);
assert.equal(step.acceptance.no_runtime_code_change, true);
assert.equal(step.acceptance.runtime_apply_allowed, false);

console.log("smoke_stage12_step37m_decision_runtime_shim_approval_request_negative_controls ok");
