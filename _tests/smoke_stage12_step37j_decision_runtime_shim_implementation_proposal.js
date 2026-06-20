"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const manifestPath = "_workflow/patch_manifests/stage12_step37j_decision_runtime_shim_implementation_package_proposal_no_apply.json";
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

assert.equal(manifest.status, "implementation_package_proposal_no_apply");
assert.equal(manifest.step, "stage12_step37j_decision_runtime_shim_implementation_package_proposal_no_apply");
assert.equal(manifest.applyable_candidate, true);
assert.equal(manifest.authorized_now, false);
assert.equal(manifest.apply_changes_allowed, false);
assert.equal(manifest.runtime_change_authorized, false);
assert.equal(manifest.runtime_change_allowed_next, false);
assert.equal(manifest.proposal_only, true);
assert.equal(manifest.write_runtime_files_now, false);
assert.equal(manifest.patch_integration_targets_now, false);

const modules = manifest.implementation_proposal.modules;
assert.equal(modules.length, runtimeFiles.length);
for (const file of runtimeFiles) {
  const item = modules.find((entry) => entry.file === file);
  assert.ok(item, `${file} must be proposed`);
  assert.ok(item.export, `${file} must declare export`);
  assert.ok(Array.isArray(item.input_shape) && item.input_shape.length >= 3);
  assert.ok(Array.isArray(item.return_shape) && item.return_shape.length >= 3);
  assert.ok(Array.isArray(item.rules) && item.rules.length >= 4);
}

const context = modules.find((entry) => entry.file.endsWith("context_builder.js"));
assert.ok(context.rules.includes("redacted_summary_only"));
assert.ok(context.rules.includes("no_raw_arguments"));
assert.ok(context.rules.includes("no_secrets_or_tokens"));

const policy = modules.find((entry) => entry.file.endsWith("policy.js"));
assert.ok(policy.rules.includes("explicit_allow_only"));
assert.ok(policy.rules.includes("preserve_json_rpc_error_shape"));
assert.ok(policy.rules.includes("no_connector_surface_change"));

const receipt = modules.find((entry) => entry.file.endsWith("receipt.js"));
assert.ok(receipt.rules.includes("redacted_receipt"));
assert.ok(receipt.rules.includes("deterministic_shape"));
assert.ok(receipt.rules.includes("no_audit_storage_change"));

const patches = manifest.implementation_proposal.integration_patch_proposals;
assert.equal(patches.length, integrationTargets.length);
for (const file of integrationTargets) {
  assert.equal(fs.existsSync(file), true, `${file} must exist as proposal target`);
  const item = patches.find((entry) => entry.file === file);
  assert.ok(item, `${file} must have proposal`);
  assert.equal(item.patch_now, false);
  assert.ok(item.proposal);
}

for (const blocker of [
  "operator has not approved runtime file creation",
  "operator has not approved integration target patching",
  "operator has not approved validation plan",
  "operator has not approved rollback plan",
  "operator has not decided restart and connector refresh policy",
]) {
  assert.ok(manifest.pre_apply_blockers.includes(blocker), `missing blocker: ${blocker}`);
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
const id = "stage12_step37j_decision_runtime_shim_implementation_package_proposal_no_apply";
const completed = Array.isArray(state.completed_work_packages) ? state.completed_work_packages : [];
const step = state.current_work_package.id === id ? state.current_work_package : completed.find((item) => item && item.id === id);
assert.ok(step, "Step 37J must remain current or completed");
assert.equal(step.acceptance.implementation_proposal_created, true);
assert.equal(step.acceptance.authorized_now, false);
assert.equal(step.acceptance.no_runtime_code_change, true);
assert.equal(step.acceptance.runtime_apply_allowed, false);

console.log("smoke_stage12_step37j_decision_runtime_shim_implementation_proposal ok");
