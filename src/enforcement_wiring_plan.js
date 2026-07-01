"use strict";

const FUTURE_ENFORCEMENT_HOOK = Object.freeze({
  target_file: "src/runtime/tools_call_handler.js",
  target_function: "handleToolsCall",
  route: "tools/call",
  insertion_point: "after evaluateDecisionRuntimePolicy/buildDecisionRuntimeReceipt and before tool_call_start/handler execution",
  current_behavior: "decision_runtime_policy remains compatibility-only and does not enforce resource policy decisions",
  future_behavior: "optional operator-approved policy preflight decision may deny before tool_call_start and before tool handler execution",
});

const REQUIRED_CONTEXT_FIELDS = Object.freeze([
  "request_id",
  "session_id",
  "auth_mode",
  "profile_surface",
  "tool_name",
  "tool_arguments_shape_hash",
  "registry_context",
  "policy_coverage_matrix",
  "policy_preflight_evaluation",
  "redacted_policy_preflight_receipt",
]);

const REQUIRED_TESTS_FOR_APPLY = Object.freeze([
  "unknown tool remains -32602/-32601 compatible as currently specified",
  "known allowed tool executes unchanged when enforcement gate allows",
  "known denied tool returns deterministic JSON-RPC error only after explicit operator approval marker",
  "tool_call_start is not emitted for denied calls",
  "redacted policy receipt contains no raw argument values",
  "runtime status schema remains unchanged unless separately approved",
  "public connector surface remains unchanged unless separately approved",
  "full run_all --skip-network remains green",
]);

function buildEnforcementWiringPlan({ readinessReport, operatorApproval = false } = {}) {
  if (!readinessReport || typeof readinessReport !== "object") {
    throw new Error("buildEnforcementWiringPlan requires readinessReport object.");
  }
  const readyForReview = readinessReport.ready_for_operator_review === true;
  return Object.freeze({
    schema_version: "stage12-enforcement-wiring-plan-v1",
    mode: "plan_only_no_apply",
    hook: FUTURE_ENFORCEMENT_HOOK,
    required_context_fields: REQUIRED_CONTEXT_FIELDS.slice(),
    required_tests_for_apply: REQUIRED_TESTS_FOR_APPLY.slice(),
    readiness: {
      ready_for_operator_review: readyForReview,
      ready_for_runtime_enforcement: false,
      readiness_report_ready_for_runtime_enforcement: readinessReport.ready_for_runtime_enforcement === true,
      operator_approval_present: operatorApproval === true,
    },
    apply_allowed_now: false,
    runtime_enforcement_enabled: false,
    runtime_enforcement_changed: false,
    allow_deny_behavior_changed: false,
    connector_visible_schema_changed: false,
    dispatch_behavior_changed: false,
    files_to_modify_if_approved_later: [
      "src/runtime/tools_call_handler.js",
      "src/runtime/decision_runtime_policy.js",
      "src/runtime/decision_runtime_receipt.js",
      "_tests/<future_policy_enforcement_apply_guard>.js",
    ],
    explicit_operator_approval_required_for: [
      "wire_policy_preflight_into_tools_call",
      "return_runtime_policy_denial_error",
      "emit_runtime_policy_denial_audit_event",
      "change_allow_deny_behavior",
    ],
    blockers: operatorApproval === true ? [
      "Plan-only package; apply is intentionally disabled in the current package",
    ] : [
      "missing explicit operator approval for runtime enforcement",
      "Plan-only package; apply is intentionally disabled in the current package",
    ],
  });
}

module.exports = {
  FUTURE_ENFORCEMENT_HOOK,
  REQUIRED_CONTEXT_FIELDS,
  REQUIRED_TESTS_FOR_APPLY,
  buildEnforcementWiringPlan,
};
