"use strict";

const REQUIRED_APPROVAL_MARKER = "operator_approved_runtime_policy_enforcement_apply";

function normalizeApprovalMarker(marker) {
  if (!marker || typeof marker !== "object") return { present: false, valid: false, reasons: ["approval_marker_missing"] };
  const reasons = [];
  if (marker.id !== REQUIRED_APPROVAL_MARKER) reasons.push("approval_marker_id_invalid");
  if (marker.approved !== true) reasons.push("approval_marker_not_approved");
  if (marker.runtime_enforcement_authorized !== true) reasons.push("runtime_enforcement_not_authorized_by_marker");
  if (marker.allow_deny_behavior_change_authorized !== true) reasons.push("allow_deny_behavior_change_not_authorized_by_marker");
  if (typeof marker.approved_by !== "string" || marker.approved_by.length === 0) reasons.push("approved_by_missing");
  if (typeof marker.approved_at !== "string" || marker.approved_at.length === 0) reasons.push("approved_at_missing");
  return { present: true, valid: reasons.length === 0, reasons };
}

function evaluateEnforcementOperatorApprovalBoundary({ readinessReport, wiringPlan, approvalMarker = null, stage = "plan_only_runtime_enforcement_boundary" } = {}) {
  if (!readinessReport || !wiringPlan) throw new Error("evaluateEnforcementOperatorApprovalBoundary requires readinessReport and wiringPlan.");
  const approval = normalizeApprovalMarker(approvalMarker);
  const violations = [];
  if (readinessReport.runtime_enforcement_enabled === true) violations.push("readiness_report_runtime_enforcement_enabled");
  if (readinessReport.runtime_enforcement_changed === true) violations.push("readiness_report_runtime_enforcement_changed");
  if (readinessReport.allow_deny_behavior_changed === true) violations.push("readiness_report_allow_deny_behavior_changed");
  if (readinessReport.ready_for_runtime_enforcement === true) violations.push("readiness_report_claims_runtime_enforcement_ready");
  if (wiringPlan.apply_allowed_now === true) violations.push("wiring_plan_apply_allowed_now_true");
  if (wiringPlan.runtime_enforcement_enabled === true) violations.push("wiring_plan_runtime_enforcement_enabled");
  if (wiringPlan.runtime_enforcement_changed === true) violations.push("wiring_plan_runtime_enforcement_changed");
  if (wiringPlan.allow_deny_behavior_changed === true) violations.push("wiring_plan_allow_deny_behavior_changed");
  if (wiringPlan.dispatch_behavior_changed === true) violations.push("wiring_plan_dispatch_behavior_changed");
  const blockers = [...approval.reasons, ...violations];
  if (stage === "plan_only_runtime_enforcement_boundary") blockers.push("plan_only_boundary_guard_is_no_apply_even_with_valid_marker");
  return Object.freeze({
    schema_version: "runtime-enforcement-operator-approval-boundary-guard-v1",
    mode: "boundary_guard_no_apply",
    approval_marker_required: true,
    required_marker_id: REQUIRED_APPROVAL_MARKER,
    approval_marker_present: approval.present,
    approval_marker_valid: approval.valid,
    boundary_violations: violations,
    blockers,
    apply_allowed_now: false,
    runtime_enforcement_enabled: false,
    runtime_enforcement_changed: false,
    allow_deny_behavior_changed: false,
    dispatch_behavior_changed: false,
    connector_visible_schema_changed: false,
  });
}

module.exports = { REQUIRED_APPROVAL_MARKER, evaluateEnforcementOperatorApprovalBoundary, normalizeApprovalMarker };
