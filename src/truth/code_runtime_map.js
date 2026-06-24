const fs = require("node:fs");
const path = require("node:path");
const { EXPECTED } = require("./project_truth_audit");

function exists(repoRoot, relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function buildCodeRuntimeMap(options = {}) {
  const repoRoot = options.repoRoot || path.resolve(__dirname, "..", "..");
  const plannedTruthModules = [
    "src/truth/project_truth_audit.js",
    "src/truth/code_runtime_map.js",
    "src/truth/change_workflow_simulator.js",
    "src/truth/parity_audit.js",
  ];
  const runtimeEntryPoints = [
    { file: "server.js", role: "current TEST MCP runtime entrypoint", planned_stage: "8.53b" },
  ];
  const canonicalDocs = [
    "_workflow/WORKFLOW_CANON.md",
    "_workflow/ACTIVE_WORKFLOW_INDEX.md",
    "_workflow/state.json",
    "SERVER_SPEC.json",
  ];
  const controlPlane = [
    "_workflow/scripts/test_mcp_backup.ps1",
    "_workflow/scripts/test_mcp_deploy.ps1",
    "_workflow/scripts/test_mcp_rollback.ps1",
    "_workflow/scripts/test_mcp_restart.ps1",
  ];
  const guards = [
    "_tests/smoke_stage8_39_course_correction_ledger.js",
    "_tests/smoke_stage8_52c_preflight_control_plane_guard.js",
    "_tests/smoke_stage8_52e_mechanism_parity_matrix.js",
    "_tests/smoke_stage8_53a_truth_parity_internal.js",
  ];

  const missing = [];
  for (const relPath of [...plannedTruthModules, ...canonicalDocs, ...controlPlane, ...guards]) {
    if (!exists(repoRoot, relPath)) missing.push(relPath);
  }

  return {
    version: "test-mcp-internal-code-runtime-map-v1",
    status: missing.length === 0 ? "ok" : "missing_expected_files",
    read_only: true,
    connector_visible: false,
    stage_plan: {
      current: EXPECTED.current_working_course,
      next_primary: EXPECTED.next_primary,
      next_secondary: EXPECTED.next_secondary,
    },
    runtime_entrypoints: runtimeEntryPoints,
    planned_truth_modules: plannedTruthModules,
    canonical_docs: canonicalDocs,
    control_plane: controlPlane,
    guards,
    missing,
    invariant: "Stage 8 / Step 53a may add internal truth modules and tests only; Stage 8 / Step 53b owns server.js runtime extraction.",
  };
}

module.exports = {
  buildCodeRuntimeMap,
};
