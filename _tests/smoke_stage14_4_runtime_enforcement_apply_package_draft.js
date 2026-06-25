"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const json = (...parts) => JSON.parse(read(...parts));
const {
  APPROVAL_MARKER_ID,
  buildStage14RuntimeEnforcementApplyPackageDraft,
} = require("../src/stage14_runtime_enforcement_apply_package_draft");

const draft = buildStage14RuntimeEnforcementApplyPackageDraft();
const state = json("_workflow", "state.json");
const manifest = json("_tests", "run_all_smoke_scripts.json");
const toolsCall = read("src", "runtime", "tools_call_handler.js");
const policyRuntimeSpec = json("SERVER_POLICY_RUNTIME_SPEC.json");
const resourcePolicySpec = json("SERVER_RESOURCE_POLICY_SPEC.json");

assert.equal(APPROVAL_MARKER_ID, "operator_approved_runtime_policy_enforcement_apply");
assert.equal(draft.schema_version, "stage14-runtime-enforcement-apply-package-draft-v1");
assert.equal(draft.mode, "draft_only_no_apply");
assert.equal(draft.apply_allowed_now, false);
assert.equal(draft.runtime_enforcement_enabled, false);
assert.equal(draft.runtime_enforcement_changed, false);
assert.equal(draft.allow_deny_behavior_changed, false);
assert.equal(draft.dispatch_behavior_changed, false);
assert.equal(draft.connector_visible_schema_changed, false);
assert.equal(draft.runtime_imported_code_changed_now, false);
assert.equal(draft.approval_marker_recorded, false);
assert.equal(draft.approval_marker_template.approved, false);
assert.equal(draft.approval_marker_template.runtime_enforcement_authorized, false);
assert.equal(draft.approval_marker_template.allow_deny_behavior_change_authorized, false);
assert.ok(draft.future_diff_plan.some((entry) => entry.file === "src/runtime/tools_call_handler.js"));
assert.ok(draft.future_diff_plan.some((entry) => entry.file === "src/runtime/policy_enforcement_gate.js"));
assert.ok(draft.future_test_plan.includes("policy-denied known tool does not emit tool_call_start"));
assert.equal(draft.future_denial_json_rpc.code, -32602);
assert.equal(draft.future_denial_json_rpc.message, "Tool call denied by runtime policy");
assert.equal(draft.future_denial_json_rpc.raw_arguments_included, false);
assert.equal(draft.future_audit_event.event, "tool_call_policy_denied");
assert.equal(draft.future_audit_event.tool_call_start_emitted_for_denied_call, false);
assert.equal(draft.stage14_4_decisions.runtime_restart_required_now, false);
assert.equal(draft.stage14_4_decisions.connector_refresh_required_now, false);
assert.equal(draft.stage14_4_decisions.baseline_refreeze_required_now, false);
assert.equal(draft.stage14_4_decisions.future_apply_runtime_restart_required, true);
assert.equal(draft.stage14_4_decisions.future_apply_connector_refresh_required_if_surface_unchanged, false);
assert.equal(draft.stage14_4_decisions.future_apply_control_plane_snapshot_deploy_rollback_required, true);

assert.equal(policyRuntimeSpec.runtime_enforced, true);
assert.equal(resourcePolicySpec.runtime_enforced, true);
assert.equal(toolsCall.includes("policy_enforcement_gate"), true);
assert.equal(toolsCall.includes("policy_preflight"), false);
assert.ok(toolsCall.includes("tool_call_decision"));
assert.ok(toolsCall.includes("tool_call_start"));
assert.equal(state.stage14.stage14_4.status, "green");
assert.equal(state.stage14.stage14_4.apply_allowed_now, false);
assert.equal(state.stage14.stage14_4.runtime_restart_required, false);
assert.equal(state.stage14.stage14_4.connector_refresh_required, false);
assert.equal(state.stage14.stage14_4.baseline_refreeze_required, false);
assert.equal(state.stage14.stage14_4.runtime_imported_code_changed, false);
assert.equal(state.stage14.stage14_4.approval_marker_recorded, false);
assert.ok(state.stage14.stage14_4.non_actions.includes("no runtime enforcement apply"));
assert.ok(manifest.includes("_tests/smoke_stage14_4_runtime_enforcement_apply_package_draft.js"));

console.log("smoke_stage14_4_runtime_enforcement_apply_package_draft ok");
