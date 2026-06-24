"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildEnforcementApplyReadinessReport } = require("../src/enforcement_apply_readiness_report");
const { buildEnforcementWiringPlan } = require("../src/enforcement_wiring_plan");
const { REQUIRED_APPROVAL_MARKER, evaluateEnforcementOperatorApprovalBoundary, normalizeApprovalMarker } = require("../src/enforcement_operator_approval_guard");

const ROOT = path.resolve(__dirname, "..");

function readinessReport(overrides = {}) {
  return { ...buildEnforcementApplyReadinessReport({
    publicMatrix: { tool_count: 13, blocked_count: 0, runtime_enforcement_changed: false, allow_deny_behavior_changed: false, connector_visible_schema_changed: false },
    publicEvaluation: { would_deny_count: 0, would_allow_count: 13, runtime_enforcement_changed: false, allow_deny_behavior_changed: false, connector_visible_schema_changed: false },
    authorizedMatrix: { tool_count: 43, blocked_count: 0, runtime_enforcement_changed: false, allow_deny_behavior_changed: false, connector_visible_schema_changed: false },
    authorizedEvaluation: { would_deny_count: 0, would_allow_count: 43, runtime_enforcement_changed: false, allow_deny_behavior_changed: false, connector_visible_schema_changed: false },
    receiptSet: { receipt_count: 43, denied_receipt_count: 0, raw_arguments_included: false, runtime_audit_event_emitted: false },
    remediation: { declarative_gaps_removed: true, public_blocked_after: 0, authorized_blocked_after: 0, authorized_would_deny_after: 0 },
  }), ...overrides };
}
function validMarker() {
  return {
    id: REQUIRED_APPROVAL_MARKER,
    approved: true,
    runtime_enforcement_authorized: true,
    allow_deny_behavior_change_authorized: true,
    approved_by: "operator",
    approved_at: "2026-06-23T08:45:00+02:00",
  };
}

(() => {
  assert.equal(REQUIRED_APPROVAL_MARKER, "operator_approved_runtime_policy_enforcement_apply");
  assert.equal(normalizeApprovalMarker(null).valid, false);
  assert.ok(normalizeApprovalMarker(null).reasons.includes("approval_marker_missing"));
  assert.equal(normalizeApprovalMarker(validMarker()).valid, true);
  const report = readinessReport();
  const plan = buildEnforcementWiringPlan({ readinessReport: report });
  const noMarker = evaluateEnforcementOperatorApprovalBoundary({ readinessReport: report, wiringPlan: plan });
  assert.equal(noMarker.schema_version, "stage12-operator-approval-boundary-guard-v1");
  assert.equal(noMarker.mode, "boundary_guard_no_apply");
  assert.equal(noMarker.approval_marker_present, false);
  assert.equal(noMarker.approval_marker_valid, false);
  assert.equal(noMarker.apply_allowed_now, false);
  assert.equal(noMarker.runtime_enforcement_enabled, false);
  assert.equal(noMarker.allow_deny_behavior_changed, false);
  assert.ok(noMarker.blockers.includes("approval_marker_missing"));
  assert.ok(noMarker.blockers.includes("stage12_boundary_guard_is_no_apply_even_with_valid_marker"));
  const validStillNoApply = evaluateEnforcementOperatorApprovalBoundary({ readinessReport: report, wiringPlan: plan, approvalMarker: validMarker() });
  assert.equal(validStillNoApply.approval_marker_present, true);
  assert.equal(validStillNoApply.approval_marker_valid, true);
  assert.equal(validStillNoApply.apply_allowed_now, false);
  assert.deepEqual(validStillNoApply.boundary_violations, []);
  assert.deepEqual(validStillNoApply.blockers, ["stage12_boundary_guard_is_no_apply_even_with_valid_marker"]);
  const badReport = readinessReport({ runtime_enforcement_enabled: true, ready_for_runtime_enforcement: true });
  const badBoundary = evaluateEnforcementOperatorApprovalBoundary({ readinessReport: badReport, wiringPlan: plan, approvalMarker: validMarker() });
  assert.ok(badBoundary.boundary_violations.includes("readiness_report_runtime_enforcement_enabled"));
  assert.ok(badBoundary.boundary_violations.includes("readiness_report_claims_runtime_enforcement_ready"));
  const badPlan = { ...plan, apply_allowed_now: true, dispatch_behavior_changed: true };
  const badPlanBoundary = evaluateEnforcementOperatorApprovalBoundary({ readinessReport: report, wiringPlan: badPlan, approvalMarker: validMarker() });
  assert.ok(badPlanBoundary.boundary_violations.includes("wiring_plan_apply_allowed_now_true"));
  assert.ok(badPlanBoundary.boundary_violations.includes("wiring_plan_dispatch_behavior_changed"));
  const handlerSource = fs.readFileSync(path.join(ROOT, "src/runtime/tools_call_handler.js"), "utf8");
  assert.equal(handlerSource.includes("policy_preflight"), false);
  assert.equal(handlerSource.includes("enforcement_operator_approval_guard"), false);
  assert.equal(handlerSource.includes("evaluateEnforcementOperatorApprovalBoundary"), false);
  assert.throws(() => evaluateEnforcementOperatorApprovalBoundary({}), /requires readinessReport and wiringPlan/);
  console.log("smoke_stage12_operator_approval_boundary_guard ok");
})();
