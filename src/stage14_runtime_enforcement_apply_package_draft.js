"use strict";

const APPROVAL_MARKER_ID = "operator_approved_runtime_policy_enforcement_apply";

const EXACT_FUTURE_DIFF_PLAN = Object.freeze([
  Object.freeze({
    file: "src/runtime/tools_call_handler.js",
    runtime_imported: true,
    change_kind: "future_patch_only",
    insertion_point: "after tool_call_decision audit and before input validation/tool_call_start",
    operations: Object.freeze([
      "import future src/runtime/policy_enforcement_gate.js helper",
      "evaluate redacted policy enforcement gate using decision context and receipt",
      "if denied, emit tool_call_policy_denied audit event",
      "if denied, return deterministic JSON-RPC error -32602",
      "if denied, do not emit tool_call_start and do not execute handler",
    ]),
  }),
  Object.freeze({
    file: "src/runtime/policy_enforcement_gate.js",
    runtime_imported: true,
    change_kind: "future_new_helper_only",
    operations: Object.freeze([
      "accept decisionContext, decisionReceipt, and redacted policy preflight receipt",
      "return allow/deny outcome without raw argument leakage",
      "fail closed on malformed policy evaluation",
      "never mutate connector-visible descriptors or tool registry",
    ]),
  }),
]);

const FUTURE_TEST_PLAN = Object.freeze([
  "missing approval marker keeps apply disabled",
  "policy-denied known tool returns JSON-RPC -32602 Tool call denied by runtime policy",
  "policy-denied known tool emits tool_call_policy_denied audit event",
  "policy-denied known tool does not emit tool_call_start",
  "policy-denied known tool handler is not executed",
  "allowed public tool executes unchanged",
  "allowed authorized tool executes unchanged",
  "unknown tool behavior remains compatible",
  "invalid argument behavior remains compatible and distinct from policy denial",
  "redacted policy receipt contains no raw argument values",
  "full run_all --skip-network remains green",
  "server self-test remains green",
]);

function buildStage14RuntimeEnforcementApplyPackageDraft() {
  const approvalMarkerTemplate = Object.freeze({
    id: APPROVAL_MARKER_ID,
    approved: false,
    runtime_enforcement_authorized: false,
    allow_deny_behavior_change_authorized: false,
    approved_by: "<operator>",
    approved_at: "<ISO-8601 timestamp>",
    note: "Template only; not an approval marker until explicitly completed and accepted by the operator.",
  });

  return Object.freeze({
    schema_version: "stage14-runtime-enforcement-apply-package-draft-v1",
    mode: "draft_only_no_apply",
    apply_allowed_now: false,
    runtime_enforcement_enabled: false,
    runtime_enforcement_changed: false,
    allow_deny_behavior_changed: false,
    dispatch_behavior_changed: false,
    connector_visible_schema_changed: false,
    runtime_imported_code_changed_now: false,
    approval_marker_recorded: false,
    approval_marker_required: true,
    approval_marker_id: APPROVAL_MARKER_ID,
    approval_marker_template: approvalMarkerTemplate,
    future_diff_plan: EXACT_FUTURE_DIFF_PLAN,
    future_test_plan: FUTURE_TEST_PLAN,
    future_denial_json_rpc: Object.freeze({
      code: -32602,
      message: "Tool call denied by runtime policy",
      decision_code: "runtime_policy_denied",
      raw_arguments_included: false,
    }),
    future_audit_event: Object.freeze({
      event: "tool_call_policy_denied",
      raw_arguments_included: false,
      tool_call_start_emitted_for_denied_call: false,
    }),
    stage14_4_decisions: Object.freeze({
      runtime_restart_required_now: false,
      connector_refresh_required_now: false,
      baseline_refreeze_required_now: false,
      deploy_required_now: false,
      backup_required_now: false,
      future_apply_runtime_restart_required: true,
      future_apply_connector_refresh_required_if_surface_changes: true,
      future_apply_connector_refresh_required_if_surface_unchanged: false,
      future_apply_baseline_refreeze_requires_separate_stage: true,
      future_apply_control_plane_snapshot_deploy_rollback_required: true,
    }),
    non_actions: Object.freeze([
      "no runtime enforcement apply",
      "no runtime-imported code change",
      "no tools_call_handler wiring",
      "no approval marker recorded",
      "no allow/deny behavior change",
      "no server restart",
      "no connector refresh",
      "no deploy",
      "no baseline refreeze",
    ]),
  });
}

module.exports = {
  APPROVAL_MARKER_ID,
  EXACT_FUTURE_DIFF_PLAN,
  FUTURE_TEST_PLAN,
  buildStage14RuntimeEnforcementApplyPackageDraft,
};
