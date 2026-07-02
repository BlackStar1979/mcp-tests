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
  runtime_compatibility_label: CURRENT_COMPATIBILITY_LABEL,
  runtime_stage_status: CURRENT_STAGE_STATUS,
  current_working_course: "stage8_52e-cross-server-mechanism-parity-matrix-complete",
  next_primary: "stage8_53a-internal-truth-tools-parity-preflight",
  next_secondary: "stage8_53b-server-entrypoint-split",
  tool_names_hash: "ef588fb6c45448bc",
  input_schema_fingerprint: "7f71f40c71e6d87a",
  output_schema_fingerprint: "21a9bb7388198894",
  descriptor_fingerprint: "bf974ebd2a5c004e",
  combined_fingerprint: "e2d4957058b360f2",
});

function readText(repoRoot, relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function exists(repoRoot, relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function requireIncludes(findings, name, text, needle) {
  const ok = text.includes(needle);
  if (!ok) findings.push({ severity: "warning", code: "missing_text", file: name, expected: needle });
  return ok;
}

function buildProjectTruthAudit(options = {}) {
  const repoRoot = options.repoRoot || path.resolve(__dirname, "..", "..");
  const findings = [];
  const docs = {
    working_course: readText(repoRoot, "_workflow/WORKFLOW_CANON.md"),
    server_spec: readText(repoRoot, "SERVER_SPEC.json"),
    index: readText(repoRoot, "_workflow/ACTIVE_WORKFLOW_INDEX.md"),
    handoff: readText(repoRoot, "_workflow/state.json"),
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
  if (CURRENT_WORKING_COURSE !== EXPECTED.current_working_course) {
    findings.push({ severity: "error", code: "current_working_course_drift", actual: CURRENT_WORKING_COURSE, expected: EXPECTED.current_working_course });
  }
  if (NEXT_PRIMARY_STAGE !== EXPECTED.next_primary) {
    findings.push({ severity: "error", code: "next_primary_stage_drift", actual: NEXT_PRIMARY_STAGE, expected: EXPECTED.next_primary });
  }
  if (NEXT_SECONDARY_STAGE !== EXPECTED.next_secondary) {
    findings.push({ severity: "error", code: "next_secondary_stage_drift", actual: NEXT_SECONDARY_STAGE, expected: EXPECTED.next_secondary });
  }

  for (const [name, text] of Object.entries(docs)) {
    requireIncludes(findings, name, text, EXPECTED.current_working_course);
    requireIncludes(findings, name, text, EXPECTED.next_primary);
    requireIncludes(findings, name, text, EXPECTED.next_secondary);
    requireIncludes(findings, name, text, "Stage 8 / Step 53a");
    requireIncludes(findings, name, text, "Stage 8 / Step 53b");
    requireIncludes(findings, name, text, "truth_tools");
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
      current_working_course: CURRENT_WORKING_COURSE,
      next_primary: NEXT_PRIMARY_STAGE,
      next_secondary: NEXT_SECONDARY_STAGE,
    },
    expected: EXPECTED,
    checked_docs: Object.keys(docs),
    findings,
  };
}

module.exports = {
  EXPECTED,
  buildProjectTruthAudit,
};
