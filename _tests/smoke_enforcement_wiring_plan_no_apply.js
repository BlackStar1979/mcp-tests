"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  FUTURE_ENFORCEMENT_HOOK,
  REQUIRED_CONTEXT_FIELDS,
  REQUIRED_TESTS_FOR_APPLY,
  buildEnforcementWiringPlan,
} = require("../src/enforcement_wiring_plan");
const { buildEnforcementApplyReadinessReport } = require("../src/enforcement_apply_readiness_report");

const ROOT = path.resolve(__dirname, "..");

function fakeReadinessReport() {
  return buildEnforcementApplyReadinessReport({
    publicMatrix: { tool_count: 13, blocked_count: 0, runtime_enforcement_changed: false, allow_deny_behavior_changed: false, connector_visible_schema_changed: false },
    publicEvaluation: { would_deny_count: 0, would_allow_count: 13, runtime_enforcement_changed: false, allow_deny_behavior_changed: false, connector_visible_schema_changed: false },
    authorizedMatrix: { tool_count: 43, blocked_count: 0, runtime_enforcement_changed: false, allow_deny_behavior_changed: false, connector_visible_schema_changed: false },
    authorizedEvaluation: { would_deny_count: 0, would_allow_count: 43, runtime_enforcement_changed: false, allow_deny_behavior_changed: false, connector_visible_schema_changed: false },
    receiptSet: { receipt_count: 43, denied_receipt_count: 0, raw_arguments_included: false, runtime_audit_event_emitted: false },
    remediation: { declarative_gaps_removed: true, public_blocked_after: 0, authorized_blocked_after: 0, authorized_would_deny_after: 0 },
  });
}

(() => {
  assert.equal(FUTURE_ENFORCEMENT_HOOK.target_file, "src/runtime/tools_call_handler.js");
  assert.equal(FUTURE_ENFORCEMENT_HOOK.target_function, "handleToolsCall");
  assert.equal(FUTURE_ENFORCEMENT_HOOK.route, "tools/call");
  assert.ok(FUTURE_ENFORCEMENT_HOOK.insertion_point.includes("before tool_call_start"));

  const plan = buildEnforcementWiringPlan({ readinessReport: fakeReadinessReport() });
  assert.equal(plan.schema_version, "stage12-enforcement-wiring-plan-v1");
  assert.equal(plan.mode, "plan_only_no_apply");
  assert.equal(plan.readiness.ready_for_operator_review, true);
  assert.equal(plan.readiness.ready_for_runtime_enforcement, false);
  assert.equal(plan.readiness.operator_approval_present, false);
  assert.equal(plan.apply_allowed_now, false);
  assert.equal(plan.runtime_enforcement_enabled, false);
  assert.equal(plan.runtime_enforcement_changed, false);
  assert.equal(plan.allow_deny_behavior_changed, false);
  assert.equal(plan.connector_visible_schema_changed, false);
  assert.equal(plan.dispatch_behavior_changed, false);
  assert.ok(plan.blockers.includes("missing explicit operator approval for runtime enforcement"));
  assert.ok(plan.blockers.includes("Plan-only package; apply is intentionally disabled in the current package"));

  for (const field of ["registry_context", "policy_preflight_evaluation", "redacted_policy_preflight_receipt"]) {
    assert.ok(REQUIRED_CONTEXT_FIELDS.includes(field), `missing context field ${field}`);
    assert.ok(plan.required_context_fields.includes(field), `plan missing context field ${field}`);
  }
  for (const requiredTest of ["tool_call_start is not emitted for denied calls", "redacted policy receipt contains no raw argument values"]) {
    assert.ok(REQUIRED_TESTS_FOR_APPLY.includes(requiredTest), `missing required future test ${requiredTest}`);
    assert.ok(plan.required_tests_for_apply.includes(requiredTest), `plan missing future test ${requiredTest}`);
  }
  assert.ok(plan.files_to_modify_if_approved_later.includes("src/runtime/tools_call_handler.js"));
  assert.ok(plan.explicit_operator_approval_required_for.includes("change_allow_deny_behavior"));

  const approvedStillNoApply = buildEnforcementWiringPlan({ readinessReport: fakeReadinessReport(), operatorApproval: true });
  assert.equal(approvedStillNoApply.readiness.operator_approval_present, true);
  assert.equal(approvedStillNoApply.apply_allowed_now, false);
  assert.equal(approvedStillNoApply.dispatch_behavior_changed, false);
  assert.deepEqual(approvedStillNoApply.blockers, ["Plan-only package; apply is intentionally disabled in the current package"]);

  const handlerSource = fs.readFileSync(path.join(ROOT, "src/runtime/tools_call_handler.js"), "utf8");
  assert.equal(handlerSource.includes("policy_preflight"), false, "tools_call_handler must not be wired to policy preflight in the current plan-only package");
  assert.equal(handlerSource.includes("buildEnforcementWiringPlan"), false, "tools_call_handler must not import wiring plan");
  assert.equal(handlerSource.includes("buildEnforcementApplyReadinessReport"), false, "tools_call_handler must not import readiness report");

  assert.throws(() => buildEnforcementWiringPlan({}), /requires readinessReport object/);
  console.log("smoke_enforcement_wiring_plan_no_apply ok");
})();
