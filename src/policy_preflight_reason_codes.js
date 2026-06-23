"use strict";

const POLICY_PREFLIGHT_REASON_CODES = Object.freeze({
  descriptor_missing_or_mismatch: {
    code: "descriptor_missing_or_mismatch",
    severity: "deny",
    description: "Registry descriptor is missing or does not match the tool name.",
  },
  missing_tool_policy: {
    code: "missing_tool_policy",
    severity: "deny",
    description: "Tool has no runtime TOOL_POLICIES entry.",
  },
  missing_catalog_entry: {
    code: "missing_catalog_entry",
    severity: "deny",
    description: "Tool has no SERVER_TOOLS_SPEC.tool_catalog entry.",
  },
  resource_class_missing: {
    code: "resource_class_missing",
    severity: "deny",
    description: "Catalog entry does not declare resource_class.",
  },
  resource_class_unknown: {
    code: "resource_class_unknown",
    severity: "deny",
    description: "Catalog resource_class is not declared in SERVER_RESOURCE_POLICY_SPEC.",
  },
  operation_class_missing: {
    code: "operation_class_missing",
    severity: "deny",
    description: "Catalog entry does not declare operation_class.",
  },
  operation_class_unknown: {
    code: "operation_class_unknown",
    severity: "deny",
    description: "Catalog operation_class is not declared in SERVER_RESOURCE_POLICY_SPEC.",
  },
  operation_not_allowed_for_resource_class: {
    code: "operation_not_allowed_for_resource_class",
    severity: "deny",
    description: "Operation class is not listed as allowed for the declared resource class.",
  },
  profile_resource_class_not_allowed: {
    code: "profile_resource_class_not_allowed",
    severity: "deny",
    description: "Profile surface allowed_resource_policy_refs does not include the tool resource class.",
  },
  profile_resource_class_denied: {
    code: "profile_resource_class_denied",
    severity: "deny",
    description: "Profile surface denied_resource_policy_refs explicitly denies the tool resource class.",
  },
  public_surface_resource_not_allowed: {
    code: "public_surface_resource_not_allowed",
    severity: "deny",
    description: "Public surface includes a resource class not allowed on public surface.",
  },
  public_tool_not_public_safe: {
    code: "public_tool_not_public_safe",
    severity: "deny",
    description: "Tool is cataloged as public but TOOL_POLICIES does not mark it public_safe.",
  },
  mutating_operation_without_audit_required: {
    code: "mutating_operation_without_audit_required",
    severity: "deny",
    description: "Mutating operation lacks audit_required in catalog metadata.",
  },
  mutating_operation_marked_read_only: {
    code: "mutating_operation_marked_read_only",
    severity: "deny",
    description: "Mutating operation is marked read_only in TOOL_POLICIES.",
  },
});

function getReasonCode(code) {
  return POLICY_PREFLIGHT_REASON_CODES[code] || null;
}

function assertKnownReasonCodes(codes) {
  const unknown = Array.from(new Set(codes)).filter((code) => !getReasonCode(code));
  if (unknown.length > 0) {
    throw new Error(`Unknown policy preflight reason codes: ${unknown.join(", ")}`);
  }
  return true;
}

function evaluatePolicyPreflightEntry(entry) {
  const reason_codes = Array.from(new Set(entry.errors || [])).sort();
  assertKnownReasonCodes(reason_codes);
  const would_deny = reason_codes.length > 0;
  return Object.freeze({
    schema_version: "stage10-policy-preflight-entry-v1",
    tool: entry.name,
    would_allow: !would_deny,
    would_deny,
    reason_codes,
    reason_details: reason_codes.map((code) => POLICY_PREFLIGHT_REASON_CODES[code]),
    resource_class: entry.resource_class || null,
    operation_class: entry.operation_class || null,
    surface_class: entry.surface_class || null,
    mutation: entry.mutation === true,
    audit_required: entry.audit_required === true,
    runtime_enforcement_changed: false,
    allow_deny_behavior_changed: false,
  });
}

function evaluatePolicyPreflightMatrix(matrix) {
  if (!matrix || !Array.isArray(matrix.entries)) {
    throw new Error("evaluatePolicyPreflightMatrix requires coverage matrix entries.");
  }
  const decisions = matrix.entries.map(evaluatePolicyPreflightEntry);
  const denied = decisions.filter((decision) => decision.would_deny);
  const allowed = decisions.filter((decision) => decision.would_allow);
  return Object.freeze({
    schema_version: "stage10-policy-preflight-dry-run-v1",
    mode: "dry_run_only",
    tool_count: decisions.length,
    would_allow_count: allowed.length,
    would_deny_count: denied.length,
    denied_tools: denied.map((decision) => ({ tool: decision.tool, reason_codes: decision.reason_codes })),
    allowed_tools: allowed.map((decision) => decision.tool),
    decisions,
    runtime_enforcement_changed: false,
    allow_deny_behavior_changed: false,
    connector_visible_schema_changed: false,
    execute_allowed_now: false,
  });
}

module.exports = {
  POLICY_PREFLIGHT_REASON_CODES,
  assertKnownReasonCodes,
  evaluatePolicyPreflightEntry,
  evaluatePolicyPreflightMatrix,
  getReasonCode,
};
