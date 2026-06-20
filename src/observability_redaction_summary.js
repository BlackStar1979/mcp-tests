const crypto = require("node:crypto");
const { buildRedactedAuditExport } = require("./audit_export_redactor");

const OBSERVABILITY_REDACTION_SUMMARY_VERSION = "test-mcp-observability-redaction-summary-v1";

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function boundedRiskCounts(safety = {}) {
  return {
    raw_path_like_value_count: Number(safety.raw_path_like_value_count || 0),
    sensitive_path_hint_count: Number(safety.sensitive_path_hint_count || 0),
    absolute_path_hint_count: Number(safety.absolute_path_hint_count || 0),
    relative_path_hint_count: Number(safety.relative_path_hint_count || 0),
  };
}

function buildObservabilityRedactionSummary({ auditLikePayload = {}, source = "observability_status", detailLevel = "summary" } = {}) {
  const redactedExport = buildRedactedAuditExport(auditLikePayload);
  const before = redactedExport.before_safety || {};
  const after = redactedExport.after_safety || {};
  const stats = redactedExport.redaction_stats || {};

  const summary = {
    success: redactedExport.success === true,
    error: redactedExport.success === true ? "" : redactedExport.error || "redaction summary unsafe",
    mode: "observability-redaction-summary-prototype",
    summary_version: OBSERVABILITY_REDACTION_SUMMARY_VERSION,
    source: String(source || "observability_status"),
    detail_level: String(detailLevel || "summary"),
    export_mode: "redacted_summary_only",
    raw_export_allowed: false,
    raw_payload_included: false,
    redacted_payload_included: false,
    redacted_payload_hash: redactedExport.redacted_payload_hash || "",
    before_export_safe: before.export_safe === true,
    after_export_safe: after.export_safe === true,
    before_risk_counts: boundedRiskCounts(before),
    after_risk_counts: boundedRiskCounts(after),
    redaction_counts: {
      inspected_string_count: Number(stats.inspected_string_count || 0),
      redacted_string_count: Number(stats.redacted_string_count || 0),
      redacted_key_count: Number(stats.redacted_key_count || 0),
      path_like_value_count: Number(stats.path_like_value_count || 0),
      sensitive_path_hint_count: Number(stats.sensitive_path_hint_count || 0),
      truncated_value_count: Number(stats.truncated_value_count || 0),
    },
    safety_decision: redactedExport.success === true ? "safe_for_summary_export" : "blocked_after_redaction",
    observability_status_schema_changed: false,
    connector_visible_change: false,
    connector_refresh_required_now: false,
    runtime_restart_required_now: false,
    raw_audit_log_mutated: false,
    public_export_tool_added: false,
    blockers: redactedExport.success === true ? [] : ["redacted summary is not export safe"],
  };

  return {
    ...summary,
    summary_hash: hashJson(summary),
  };
}

function verifyObservabilityRedactionSummary(summary = {}) {
  const errors = [];
  if (summary.summary_version !== OBSERVABILITY_REDACTION_SUMMARY_VERSION) errors.push("unsupported summary version");
  if (summary.raw_export_allowed !== false) errors.push("raw_export_allowed must be false");
  if (summary.raw_payload_included !== false) errors.push("raw_payload_included must be false");
  if (summary.redacted_payload_included !== false) errors.push("redacted_payload_included must be false");
  if (summary.after_export_safe !== true) errors.push("after_export_safe must be true");
  if (summary.observability_status_schema_changed !== false) errors.push("observability_status schema must not change");
  if (summary.connector_visible_change !== false) errors.push("connector visible change must be false");
  if (summary.connector_refresh_required_now !== false) errors.push("connector refresh must not be required now");
  if (summary.raw_audit_log_mutated !== false) errors.push("raw audit log must not be mutated");
  if (summary.public_export_tool_added !== false) errors.push("public export tool must not be added");
  if (!summary.summary_hash || typeof summary.summary_hash !== "string") errors.push("summary_hash is required");

  const copy = { ...summary };
  delete copy.summary_hash;
  if (summary.summary_hash && summary.summary_hash !== hashJson(copy)) errors.push("summary_hash mismatch");

  return {
    success: errors.length === 0,
    error: errors.join("; "),
    version: OBSERVABILITY_REDACTION_SUMMARY_VERSION,
    errors,
  };
}

module.exports = {
  OBSERVABILITY_REDACTION_SUMMARY_VERSION,
  buildObservabilityRedactionSummary,
  verifyObservabilityRedactionSummary,
};
