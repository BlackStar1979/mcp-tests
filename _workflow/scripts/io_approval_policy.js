"use strict";

const IO_APPROVAL_POLICY_VERSION = "mcp-io-approval-policy-v1";

const ACTION_RULES = Object.freeze({
  read_public: { require_approval: false, sensitivity: "low" },
  read_internal: { require_approval: true, sensitivity: "medium" },
  send_external: { require_approval: true, sensitivity: "high" },
  write_state: { require_approval: true, sensitivity: "high" },
  write_file: { require_approval: true, sensitivity: "high" },
  deploy: { require_approval: true, sensitivity: "critical" },
  delete_or_destructive: { require_approval: true, sensitivity: "critical" },
  plugin_execute: { require_approval: true, sensitivity: "high" },
  connector_mutation: { require_approval: true, sensitivity: "critical" },
});

function evaluateApprovalRequirement(action = {}) {
  const kind = action.kind || "read_public";
  const rule = ACTION_RULES[kind];
  if (!rule) {
    return {
      policy_version: IO_APPROVAL_POLICY_VERSION,
      kind,
      known_action: false,
      require_approval: true,
      sensitivity: "unknown",
      blocked_until_review: true,
      reasons: ["unknown action kind defaults to approval required"],
    };
  }
  const reasons = [];
  let requireApproval = rule.require_approval;
  if (action.data_classes && action.data_classes.some((cls) => ["secret_or_credential", "pii_like", "private_path_or_file"].includes(cls))) {
    requireApproval = true;
    reasons.push("sensitive data class present");
  }
  if (action.external_domain && !action.trusted_domain) {
    requireApproval = true;
    reasons.push("external untrusted domain present");
  }
  if (action.prompt_injection_severity && ["medium", "high", "critical"].includes(action.prompt_injection_severity)) {
    requireApproval = true;
    reasons.push("prompt injection finding present");
  }
  return {
    policy_version: IO_APPROVAL_POLICY_VERSION,
    kind,
    known_action: true,
    require_approval: requireApproval,
    sensitivity: rule.sensitivity,
    blocked_until_review: requireApproval && action.approved !== true,
    reasons,
  };
}

function validateApprovalPolicy() {
  const errors = [];
  for (const [kind, rule] of Object.entries(ACTION_RULES)) {
    if (typeof rule.require_approval !== "boolean") errors.push(`${kind} missing require_approval`);
    if (!rule.sensitivity) errors.push(`${kind} missing sensitivity`);
  }
  for (const critical of ["deploy", "delete_or_destructive", "connector_mutation"]) {
    if (ACTION_RULES[critical].require_approval !== true) errors.push(`${critical} must require approval`);
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  IO_APPROVAL_POLICY_VERSION,
  ACTION_RULES,
  evaluateApprovalRequirement,
  validateApprovalPolicy,
};
