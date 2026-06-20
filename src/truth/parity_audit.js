const { buildMechanismParityReport } = require("../mechanism_parity_matrix");

const REQUIRED_GPT_MCP_MECHANISMS = [
  "index_mechanisms",
  "filesystem_mechanisms",
  "science_data_introspection_mechanisms",
  "connector_safe_code_mechanisms",
  "registry_governance_mechanisms",
  "web_access_mechanisms",
  "truth_drift_detection_mechanisms",
  "process_runner_policy_mechanisms",
  "remote_site_lifecycle_mechanisms",
  "deploy_rollback_control_plane_mechanisms",
];

function buildParityAudit() {
  const report = buildMechanismParityReport();
  const findings = [];
  const mechanisms = new Map(report.mechanisms.map((entry) => [entry.mechanism, entry]));

  for (const mechanism of REQUIRED_GPT_MCP_MECHANISMS) {
    if (!mechanisms.has(mechanism)) {
      findings.push({ severity: "error", code: "missing_required_mechanism", mechanism });
    }
  }

  for (const entry of report.mechanisms) {
    if (!entry.endurance_status) findings.push({ severity: "error", code: "missing_endurance_status", mechanism: entry.mechanism });
    if (!entry.exposure_decision) findings.push({ severity: "error", code: "missing_exposure_decision", mechanism: entry.mechanism });
    if (!entry.hold_reason) findings.push({ severity: "error", code: "missing_hold_reason", mechanism: entry.mechanism });
    if (!entry.required_next_step) findings.push({ severity: "error", code: "missing_next_step", mechanism: entry.mechanism });
    if (!Array.isArray(entry.source_methods) || entry.source_methods.length === 0) findings.push({ severity: "error", code: "missing_source_methods", mechanism: entry.mechanism });
  }

  const truth = mechanisms.get("truth_drift_detection_mechanisms");
  if (!truth || truth.endurance_status !== "covered") {
    findings.push({ severity: "error", code: "truth_drift_detection_must_be_covered", actual: truth && truth.endurance_status });
  }

  for (const mechanism of ["process_runner_policy_mechanisms", "remote_site_lifecycle_mechanisms", "science_data_introspection_mechanisms"]) {
    const entry = mechanisms.get(mechanism);
    if (!entry || entry.endurance_status !== "on_hold" || !entry.required_next_step) {
      findings.push({ severity: "error", code: "untracked_on_hold_endurance_debt", mechanism });
    }
  }

  return {
    version: "test-mcp-internal-parity-audit-v2",
    status: findings.some((item) => item.severity === "error") ? "parity_guard_failed" : "ok",
    read_only: true,
    connector_visible: false,
    required_mechanisms: REQUIRED_GPT_MCP_MECHANISMS,
    report_status: report.status,
    covered_count: report.covered_count,
    on_hold_count: report.on_hold_count,
    required_now_count: report.required_now_count,
    findings,
  };
}

module.exports = {
  REQUIRED_GPT_MCP_MECHANISMS,
  buildParityAudit,
};
