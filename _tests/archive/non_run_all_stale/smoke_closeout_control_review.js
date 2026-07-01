"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const manifest = JSON.parse(fs.readFileSync("_workflow/patch_manifests/stage12_step38i_closeout_control_review.json", "utf8"));
const doc = fs.readFileSync("_workflow/longterm/stage12_step38i_closeout_control_review.md", "utf8");
const step38hManifest = JSON.parse(fs.readFileSync("_workflow/patch_manifests/stage12_step38h_decision_runtime_audit_receipt_review.json", "utf8"));
const step38hDoc = fs.readFileSync("_workflow/longterm/stage12_step38h_decision_runtime_audit_receipt_review.md", "utf8");

assert.equal(manifest.status, "green_closeout_control_review");
assert.equal(manifest.step, "stage12_step38i_closeout_control_review");
assert.equal(manifest.source_step, "stage12_step38h_decision_runtime_audit_receipt_review");
assert.equal(manifest.closeout_control_review_required, true);

const review = manifest.closeout_control_review;
assert.equal(review.each_step, true);
assert.ok(Array.isArray(review.active_controls));
assert.ok(review.active_controls.length >= 5);
assert.ok(Array.isArray(review.stale_controls));
assert.ok(review.stale_controls.length >= 4);
assert.equal(typeof review.stale_action, "string");
assert.match(review.stale_action, /Resolved stale controls must not block Step39/);
assert.equal(review.rec_next, "stage12_step39_new_boundary");
assert.equal(review.rec_next_semantics, "recommendation_as_next_step_includes_explicit_decisions_to_keep_lift_relax_or_archive_controls_after_review");
assert.equal(typeof review.rationale_required, "string");
assert.match(review.rationale_required, /Step38H omitted/);
assert.match(review.rationale_required, /keep, lift, relaxation, or historical-only decision requires rationale/);

const staleControlsText = JSON.stringify(review.stale_controls);
assert.match(staleControlsText, /typed_connector_raw_unknown_tool_limit_for_behavior_verification/);
assert.match(staleControlsText, /pre_step38a_missing_decision_runtime_modules_no_apply_blockers/);
assert.match(staleControlsText, /step38h_missing_explicit_stale_controls_and_stale_action_closeout_fields/);
assert.match(staleControlsText, /live_runtime_identity_stale_until_operator_restart/);

assert.equal(manifest.new_mcp_tool_added, false);
assert.equal(manifest.connector_visible_tool_surface_change, false);
assert.equal(manifest.runtime_code_change, false);
assert.equal(manifest.server_js_change, false);
assert.equal(manifest.auth_config_change, false);
assert.equal(manifest.cli_change, false);
assert.equal(manifest.db_network_memory_plugin_change, false);
assert.equal(manifest.restart_performed, false);
assert.equal(manifest.connector_refresh_performed, false);
assert.equal(manifest.raw_audit_export_performed, false);
assert.equal(manifest.next_recommended_step, "stage12_step39_new_boundary");
assert.equal(manifest.closeout_control_review.rec_next_semantics, "recommendation_as_next_step_includes_explicit_decisions_to_keep_lift_relax_or_archive_controls_after_review");

assert.ok(doc.includes("## Active controls review"));
assert.ok(doc.includes("## Stale controls review and stale action"));
assert.ok(doc.includes("## Recommended next step"));
assert.ok(doc.includes("Recommendation-as-next-step after control review"));
assert.ok(doc.includes("lift_or_archive"));
assert.ok(doc.includes("remain_active"));
assert.ok(doc.includes("Stage 12 / Step 39"));

assert.ok(Array.isArray(step38hManifest.active_controls));
assert.equal(Object.prototype.hasOwnProperty.call(step38hManifest, "stale_controls"), false, "Step38H manifest must demonstrate the original stale_controls gap");
assert.equal(Object.prototype.hasOwnProperty.call(step38hManifest, "stale_action"), false, "Step38H manifest must demonstrate the original stale_action gap");
assert.ok(step38hDoc.includes("Active controls preserved"));
assert.equal(step38hDoc.includes("Stale controls review"), false, "Step38H doc must demonstrate the original stale controls section gap");

console.log("smoke_closeout_control_review ok");
