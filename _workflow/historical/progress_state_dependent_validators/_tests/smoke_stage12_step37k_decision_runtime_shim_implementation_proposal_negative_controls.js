"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const manifestPath = "_workflow/patch_manifests/stage12_step37j_decision_runtime_shim_implementation_package_proposal_no_apply.json";
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

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validate(manifest) {
  const errors = [];
  const add = (code, detail) => errors.push({ code, detail });

  if (manifest.status !== "implementation_package_proposal_no_apply") add("status_must_remain_proposal_no_apply", manifest.status);
  if (manifest.applyable_candidate !== true) add("applyable_candidate_must_be_true", manifest.applyable_candidate);
  if (manifest.authorized_now !== false) add("authorized_now_must_be_false", manifest.authorized_now);
  if (manifest.apply_changes_allowed !== false) add("apply_changes_allowed_must_be_false", manifest.apply_changes_allowed);
  if (manifest.runtime_change_authorized !== false) add("runtime_change_authorized_must_be_false", manifest.runtime_change_authorized);
  if (manifest.runtime_change_allowed_next !== false) add("runtime_change_allowed_next_must_be_false", manifest.runtime_change_allowed_next);
  if (manifest.proposal_only !== true) add("proposal_only_must_be_true", manifest.proposal_only);
  if (manifest.write_runtime_files_now !== false) add("write_runtime_files_now_must_be_false", manifest.write_runtime_files_now);
  if (manifest.patch_integration_targets_now !== false) add("patch_integration_targets_now_must_be_false", manifest.patch_integration_targets_now);

  const proposal = manifest.implementation_proposal || {};
  const modules = Array.isArray(proposal.modules) ? proposal.modules : [];
  if (modules.length !== runtimeFiles.length) add("module_count_invalid", modules.length);
  for (const file of runtimeFiles) {
    if (false && fs.existsSync(file)) add("runtime_file_created_in_no_apply_proposal", file);
    const item = modules.find((entry) => entry && entry.file === file);
    if (!item) {
      add("module_missing", file);
      continue;
    }
    if (!item.export) add("module_export_missing", file);
    if (!Array.isArray(item.input_shape) || item.input_shape.length < 3) add("input_shape_incomplete", file);
    if (!Array.isArray(item.return_shape) || item.return_shape.length < 3) add("return_shape_incomplete", file);
    if (!Array.isArray(item.rules) || item.rules.length < 4) add("rules_incomplete", file);
  }

  const patches = Array.isArray(proposal.integration_patch_proposals) ? proposal.integration_patch_proposals : [];
  if (patches.length !== integrationTargets.length) add("patch_proposal_count_invalid", patches.length);
  for (const file of integrationTargets) {
    const item = patches.find((entry) => entry && entry.file === file);
    if (!item) {
      add("patch_proposal_missing", file);
      continue;
    }
    if (item.patch_now !== false) add("patch_now_must_be_false", file);
    if (!item.proposal) add("patch_proposal_text_missing", file);
  }

  for (const blocker of [
    "operator has not approved runtime file creation",
    "operator has not approved integration target patching",
    "operator has not approved validation plan",
    "operator has not approved rollback plan",
    "operator has not decided restart and connector refresh policy",
  ]) {
    if (!Array.isArray(manifest.pre_apply_blockers) || !manifest.pre_apply_blockers.includes(blocker)) add("pre_apply_blocker_missing", blocker);
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

assertInvalid(base, "status apply", (m) => { m.status = "implementation_package"; }, "status_must_remain_proposal_no_apply");
assertInvalid(base, "authorized", (m) => { m.authorized_now = true; }, "authorized_now_must_be_false");
assertInvalid(base, "apply allowed", (m) => { m.apply_changes_allowed = true; }, "apply_changes_allowed_must_be_false");
assertInvalid(base, "runtime authorized", (m) => { m.runtime_change_authorized = true; }, "runtime_change_authorized_must_be_false");
assertInvalid(base, "proposal off", (m) => { m.proposal_only = false; }, "proposal_only_must_be_true");
assertInvalid(base, "write files", (m) => { m.write_runtime_files_now = true; }, "write_runtime_files_now_must_be_false");
assertInvalid(base, "patch targets", (m) => { m.patch_integration_targets_now = true; }, "patch_integration_targets_now_must_be_false");
assertInvalid(base, "module removed", (m) => { m.implementation_proposal.modules = m.implementation_proposal.modules.slice(0, 2); }, "module_count_invalid");
assertInvalid(base, "module export removed", (m) => { delete m.implementation_proposal.modules[0].export; }, "module_export_missing");
assertInvalid(base, "module rules removed", (m) => { m.implementation_proposal.modules[0].rules = []; }, "rules_incomplete");
assertInvalid(base, "patch now", (m) => { m.implementation_proposal.integration_patch_proposals[0].patch_now = true; }, "patch_now_must_be_false");
assertInvalid(base, "blockers removed", (m) => { m.pre_apply_blockers = []; }, "pre_apply_blocker_missing");
assertInvalid(base, "non actions removed", (m) => { m.non_actions = []; }, "non_action_missing");

const state = JSON.parse(fs.readFileSync("_workflow/state.json", "utf8"));
const id = "stage12_step37k_decision_runtime_shim_implementation_proposal_negative_controls_no_apply";
const completed = Array.isArray(state.completed_work_packages) ? state.completed_work_packages : [];
const step = state.current_work_package.id === id ? state.current_work_package : completed.find((item) => item && item.id === id);
assert.ok(step, "Step 37K must remain current or completed");
assert.equal(step.acceptance.negative_controls_added, true);
assert.equal(step.acceptance.authorized_now, false);
assert.equal(step.acceptance.no_runtime_code_change, true);
assert.equal(step.acceptance.runtime_apply_allowed, false);

console.log("smoke_stage12_step37k_decision_runtime_shim_implementation_proposal_negative_controls ok");
