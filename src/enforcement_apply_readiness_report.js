"use strict";

function buildEnforcementApplyReadinessReport({
  publicMatrix,
  publicEvaluation,
  authorizedMatrix,
  authorizedEvaluation,
  receiptSet,
  remediation = {},
} = {}) {
  if (!publicMatrix || !publicEvaluation || !authorizedMatrix || !authorizedEvaluation || !receiptSet) {
    throw new Error("buildEnforcementApplyReadinessReport requires matrices, evaluations, and receiptSet.");
  }
  const signals = {
    public_preflight_clear: publicMatrix.blocked_count === 0 && publicEvaluation.would_deny_count === 0,
    authorized_preflight_clear: authorizedMatrix.blocked_count === 0 && authorizedEvaluation.would_deny_count === 0,
    receipts_redacted: receiptSet.raw_arguments_included === false && receiptSet.runtime_audit_event_emitted === false,
    runtime_enforcement_unchanged: publicMatrix.runtime_enforcement_changed === false && authorizedMatrix.runtime_enforcement_changed === false && publicEvaluation.runtime_enforcement_changed === false && authorizedEvaluation.runtime_enforcement_changed === false,
    allow_deny_behavior_unchanged: publicMatrix.allow_deny_behavior_changed === false && authorizedMatrix.allow_deny_behavior_changed === false && publicEvaluation.allow_deny_behavior_changed === false && authorizedEvaluation.allow_deny_behavior_changed === false,
    connector_schema_unchanged: publicMatrix.connector_visible_schema_changed === false && authorizedMatrix.connector_visible_schema_changed === false && publicEvaluation.connector_visible_schema_changed === false && authorizedEvaluation.connector_visible_schema_changed === false,
    remediation_recorded: remediation.declarative_gaps_removed === true,
  };
  const blockers = [];
  for (const [name, ok] of Object.entries(signals)) {
    if (!ok) blockers.push(name);
  }
  return Object.freeze({
    schema_version: "stage12-enforcement-apply-readiness-report-v1",
    mode: "readiness_report_only",
    ready_for_operator_review: blockers.length === 0,
    ready_for_runtime_enforcement: false,
    runtime_enforcement_enabled: false,
    runtime_enforcement_changed: false,
    allow_deny_behavior_changed: false,
    connector_visible_schema_changed: false,
    operator_approval_required_before_apply: true,
    public: {
      tool_count: publicMatrix.tool_count,
      blocked_count: publicMatrix.blocked_count,
      would_deny_count: publicEvaluation.would_deny_count,
      would_allow_count: publicEvaluation.would_allow_count,
    },
    authorized: {
      tool_count: authorizedMatrix.tool_count,
      blocked_count: authorizedMatrix.blocked_count,
      would_deny_count: authorizedEvaluation.would_deny_count,
      would_allow_count: authorizedEvaluation.would_allow_count,
    },
    receipts: {
      receipt_count: receiptSet.receipt_count,
      denied_receipt_count: receiptSet.denied_receipt_count,
      raw_arguments_included: receiptSet.raw_arguments_included,
      runtime_audit_event_emitted: receiptSet.runtime_audit_event_emitted,
    },
    remediation: {
      declarative_gaps_removed: remediation.declarative_gaps_removed === true,
      public_blocked_after: remediation.public_blocked_after ?? null,
      authorized_blocked_after: remediation.authorized_blocked_after ?? null,
      authorized_would_deny_after: remediation.authorized_would_deny_after ?? null,
    },
    signals,
    blockers,
    required_operator_approval_for_next_phase: [
      "enable_runtime_policy_enforcement",
      "change_allow_deny_behavior",
      "wire_policy_preflight_into_tools_call",
    ],
  });
}

module.exports = {
  buildEnforcementApplyReadinessReport,
};
