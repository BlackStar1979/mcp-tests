const fs = require("node:fs");
const path = require("node:path");
const {
  CURRENT_STAGE_STATUS,
  CURRENT_STAGE_STATUS_SEMANTICS,
  CURRENT_COMPATIBILITY_LABEL,
  CURRENT_COMPATIBILITY_LABEL_SEMANTICS,
  CURRENT_WORKING_COURSE,
  NEXT_PRIMARY_STAGE,
  NEXT_SECONDARY_STAGE,
} = require("../stage_metadata");
const { buildMechanismParityReport } = require("../mechanism_parity_matrix");

const EXPECTED = Object.freeze({
  server_version: "0.40.0",
  authenticated_tool_count: 98,
  runtime_compatibility_label: CURRENT_COMPATIBILITY_LABEL,
  runtime_stage_status: CURRENT_STAGE_STATUS,
  tool_names_hash: "b6526b6d88ccbee3",
  input_schema_fingerprint: "49377884818b3896",
  output_schema_fingerprint: "64961bbb24c85de3",
  descriptor_fingerprint: "62ec04eac2adec14",
  combined_fingerprint: "05a85f87dfb3304d",
});

function readText(repoRoot, relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function readJson(repoRoot, relPath) {
  return JSON.parse(readText(repoRoot, relPath));
}

function exists(repoRoot, relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function requireIncludes(findings, name, text, needle) {
  const ok = text.includes(needle);
  if (!ok) findings.push({ severity: "warning", code: "missing_text", file: name, expected: needle });
  return ok;
}

function getWorkflowProgressMarkers(repoRoot) {
  const resolvedRepoRoot = repoRoot || path.resolve(__dirname, "..", "..");
  const state = readJson(resolvedRepoRoot, "_workflow/state.json");
  return state.workflow_progress_markers;
}

function buildProjectTruthAudit(options = {}) {
  const repoRoot = options.repoRoot || path.resolve(__dirname, "..", "..");
  const findings = [];
  const workflowProgressMarkers = getWorkflowProgressMarkers(repoRoot);
  const docs = {
    working_course: readText(repoRoot, "_workflow/WORKFLOW_CANON.md"),
    server_spec: readText(repoRoot, "SERVER_SPEC.json"),
    index: readText(repoRoot, "_workflow/ACTIVE_WORKFLOW_INDEX.md"),
    handoff: readText(repoRoot, "_workflow/state.json"),
  };
  const serverSpec = JSON.parse(docs.server_spec);
  const workflowDocs = {
    working_course: docs.working_course,
    index: docs.index,
    handoff: docs.handoff,
  };

  if (CURRENT_COMPATIBILITY_LABEL !== EXPECTED.runtime_compatibility_label) {
    findings.push({ severity: "error", code: "runtime_compatibility_label_drift", actual: CURRENT_COMPATIBILITY_LABEL, expected: EXPECTED.runtime_compatibility_label });
  }
  if (CURRENT_COMPATIBILITY_LABEL_SEMANTICS !== "runtime-compatibility-label-not-repo-progress-label") {
    findings.push({ severity: "error", code: "compatibility_label_semantics_drift", actual: CURRENT_COMPATIBILITY_LABEL_SEMANTICS });
  }
  if (CURRENT_STAGE_STATUS !== EXPECTED.runtime_stage_status) {
    findings.push({ severity: "error", code: "runtime_stage_status_drift", actual: CURRENT_STAGE_STATUS, expected: EXPECTED.runtime_stage_status });
  }
  if (CURRENT_STAGE_STATUS_SEMANTICS !== "runtime-compatibility-label-not-repo-progress-label") {
    findings.push({ severity: "error", code: "stage_status_semantics_drift", actual: CURRENT_STAGE_STATUS_SEMANTICS });
  }

  if (serverSpec.server?.version !== EXPECTED.server_version) {
    findings.push({ severity: "error", code: "server_spec_version_drift", actual: serverSpec.server?.version, expected: EXPECTED.server_version });
  }
  if (serverSpec.server?.full_tests_authenticated_tool_count !== EXPECTED.authenticated_tool_count) {
    findings.push({ severity: "error", code: "server_spec_authenticated_tool_count_drift", actual: serverSpec.server?.full_tests_authenticated_tool_count, expected: EXPECTED.authenticated_tool_count });
  }

  for (const [name, text] of Object.entries(workflowDocs)) {
    requireIncludes(findings, name, text, workflowProgressMarkers.current_working_course);
    requireIncludes(findings, name, text, workflowProgressMarkers.next_primary);
    requireIncludes(findings, name, text, workflowProgressMarkers.next_secondary);
    requireIncludes(findings, name, text, "Stage 8 / Step 53b");
    requireIncludes(findings, name, text, "Stage 8 / Step 53c");
  }

  const activePrimaryStillDirectSplit = docs.working_course.includes("Next primary implementation course:\r\n\r\n```text\r\nStage 8 / Step 53 — server.js runtime container extraction")
    || docs.working_course.includes("Next primary implementation course:\n\n```text\nStage 8 / Step 53 — server.js runtime container extraction");
  if (activePrimaryStillDirectSplit) {
    findings.push({ severity: "error", code: "active_primary_course_stale_server_split" });
  }

  const parity = buildMechanismParityReport();
  for (const mechanism of ["truth_drift_detection_mechanisms", "process_runner_policy_mechanisms", "remote_site_lifecycle_mechanisms", "science_data_introspection_mechanisms"]) {
    const entry = parity.mechanisms.find((item) => item.mechanism === mechanism);
    if (!entry) findings.push({ severity: "error", code: "missing_parity_entry", mechanism });
  }

  const controlPlaneSnapshotReady = exists(repoRoot, "_workflow/control_plane/snapshots");
  if (!controlPlaneSnapshotReady) {
    findings.push({ severity: "error", code: "missing_control_plane_snapshot_root" });
  }

  return {
    version: "test-mcp-internal-truth-audit-v1",
    status: findings.some((item) => item.severity === "error") ? "drift_detected" : "ok",
    read_only: true,
    connector_visible: false,
    current: {
      runtime_compatibility_label: CURRENT_COMPATIBILITY_LABEL,
      runtime_stage_status: CURRENT_STAGE_STATUS,
      current_working_course: workflowProgressMarkers.current_working_course,
      next_primary: workflowProgressMarkers.next_primary,
      next_secondary: workflowProgressMarkers.next_secondary,
    },
    expected: {
      ...EXPECTED,
      current_working_course: workflowProgressMarkers.current_working_course,
      next_primary: workflowProgressMarkers.next_primary,
      next_secondary: workflowProgressMarkers.next_secondary,
    },
    checked_docs: Object.keys(docs),
    findings,
  };
}

module.exports = {
  EXPECTED,
  getWorkflowProgressMarkers,
  buildProjectTruthAudit,
};
