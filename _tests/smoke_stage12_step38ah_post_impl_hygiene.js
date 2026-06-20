"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const manifest = JSON.parse(fs.readFileSync("_workflow/patch_manifests/stage12_step38ah_post_impl_hygiene_blocker_reclassification.json", "utf8"));
const state = JSON.parse(fs.readFileSync("_workflow/state.json", "utf8"));

const runtimeFiles = [
  "src/runtime/decision_runtime_context_builder.js",
  "src/runtime/decision_runtime_policy.js",
  "src/runtime/decision_runtime_receipt.js",
];

assert.equal(manifest.status, "post_impl_hygiene_green");
assert.equal(manifest.step, "stage12_step38ah_post_impl_hygiene_blocker_reclassification");
assert.equal(manifest.source_step, "stage12_step38a_decision_runtime_shim_impl_go");
assert.equal(manifest.connector_visible_change, false);
assert.equal(manifest.runtime_restart_performed, false);
assert.equal(manifest.connector_refresh_performed, false);

for (const file of runtimeFiles) {
  assert.equal(fs.existsSync(file), true, `${file} must exist after Step 38A GO`);
  assert.ok(manifest.runtime_files_expected_present_now.includes(file));
}

for (const removed of [
  "do not create runtime files",
  "runtime files must remain absent",
  "proposal_only=true as a current blocker",
  "approval_request_only=true as a current blocker",
]) {
  assert.ok(manifest.obsolete_current_blockers_removed.includes(removed), `obsolete blocker not removed: ${removed}`);
}

for (const active of [
  "no runtime restart without explicit later decision",
  "no connector refresh without explicit later decision",
  "no connector-visible tool surface change",
  "no auth config change",
  "no CLI extension",
]) {
  assert.ok(manifest.active_current_blockers.includes(active), `active blocker missing: ${active}`);
}

const id = "stage12_step38ah_post_impl_hygiene_blocker_reclassification";
const done = Array.isArray(state.completed_work_packages) ? state.completed_work_packages : [];
const step = state.current_work_package.id === id ? state.current_work_package : done.find((item) => item && item.id === id) || state.previous_work_package;
assert.ok(step, "Step 38A-H must remain current, previous, or completed");
assert.equal(step.acceptance.obsolete_no_apply_controls_reclassified, true);
assert.equal(step.acceptance.no_active_runtime_absence_blocker, true);
assert.equal(step.acceptance.current_blockers_are_live_only, true);
assert.equal(step.acceptance.runtime_files_expected_present, true);
assert.equal(step.connector_visible_change, false);
assert.equal(step.restart_pending, false);
assert.equal(Object.prototype.hasOwnProperty.call(step.acceptance, "missing_decision_runtime_modules_still_absent"), false);
assert.equal(Object.prototype.hasOwnProperty.call(step.acceptance, "runtime_apply_allowed"), false);

console.log("smoke_stage12_step38ah_post_impl_hygiene ok");
