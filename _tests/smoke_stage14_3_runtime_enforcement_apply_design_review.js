"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const json = (...parts) => JSON.parse(read(...parts));

const record = read("_workflow", "operator_decisions", "stage14_3_runtime_enforcement_apply_design_review.md");
const state = json("_workflow", "state.json");
const manifest = json("_tests", "run_all_smoke_scripts.json");
const toolsCall = read("src", "runtime", "tools_call_handler.js");
const policyRuntimeSpec = json("SERVER_POLICY_RUNTIME_SPEC.json");
const resourcePolicySpec = json("SERVER_RESOURCE_POLICY_SPEC.json");
const baseline = json("_workflow", "baselines", "stage8_frozen_runtime_baseline.json");
const postStage6 = read("_workflow", "operator_decisions", "post_stage6_operator_decisions_2026-06-21.md");

for (const required of [
  "GREEN / APPLY DESIGN REVIEW / NO APPLY",
  "Post-Stage6 D7 remains binding",
  "operator_approved_runtime_policy_enforcement_apply",
  "Stage12-specific no-apply wording | Retire as future blocker text",
  "Connector refresh planning | Conditional",
  "Baseline refreeze | Conditional",
  "tool_call_policy_denied",
  "Tool call denied by runtime policy",
  "Stage 14.4 - Runtime Enforcement Apply Package Draft, Still No Apply",
  "runtime_restart_required: false",
  "connector_refresh_required: false",
  "baseline_refreeze_required: false",
  "runtime_enforcement_changed: false",
  "allow_deny_behavior_changed: false",
  "no `tools_call_handler.js` wiring",
]) assert.ok(record.includes(required), required);

assert.ok(record.includes("after `tool_call_decision`"));
assert.ok(record.includes("before input validation, `tool_call_start`, and handler execution"));
assert.ok(record.includes("runtime_restart_required: true, if live test server must run new code"));
assert.ok(record.includes("connector_refresh_required: false if tools/list descriptors and connector contract are unchanged"));
assert.ok(record.includes("control-plane snapshot/deploy/rollback plan: required before runtime mutation/deploy"));

assert.equal(policyRuntimeSpec.runtime_enforced, true);
assert.equal(resourcePolicySpec.runtime_enforced, true);
assert.equal(baseline.connectorShapeVersion, "2025-05-strict-v1");
assert.equal(toolsCall.includes("policy_preflight"), false);
assert.equal(toolsCall.includes("policy_enforcement_gate"), true);
assert.ok(postStage6.includes("Resource/Scope Matrix Enforcement"));
assert.ok(postStage6.includes("separate operator approval"));

assert.equal(state.stage14.stage14_3.status, "green");
assert.equal(state.stage14.stage14_3.apply_allowed_now, false);
assert.equal(state.stage14.stage14_3.runtime_restart_required, false);
assert.equal(state.stage14.stage14_3.connector_refresh_required, false);
assert.equal(state.stage14.stage14_3.baseline_refreeze_required, false);
assert.equal(state.stage14.stage14_3.runtime_enforcement_changed, false);
assert.equal(state.stage14.stage14_3.allow_deny_behavior_changed, false);
assert.equal(state.stage14.stage14_3.next_recommended_stage, "Stage 14.4 - Runtime Enforcement Apply Package Draft, Still No Apply");
assert.ok(state.stage14.stage14_3.blocker_reassessment.explicit_operator_approval_marker === "keep");
assert.ok(state.stage14.stage14_3.blocker_reassessment.stage12_specific_no_apply_wording === "retire_as_future_blocker_text");
assert.ok(state.stage14.stage14_3.non_actions.includes("no runtime enforcement apply"));
assert.ok(manifest.includes("_tests/smoke_stage14_3_runtime_enforcement_apply_design_review.js"));

console.log("smoke_stage14_3_runtime_enforcement_apply_design_review ok");
