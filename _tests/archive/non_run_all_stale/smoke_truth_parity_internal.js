const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { buildProjectTruthAudit, EXPECTED } = require("../src/truth/project_truth_audit");
const { buildCodeRuntimeMap } = require("../src/truth/code_runtime_map");
const { classifyChange, simulateChangeWorkflow } = require("../src/truth/change_workflow_simulator");
const { buildParityAudit, REQUIRED_GPT_MCP_MECHANISMS } = require("../src/truth/parity_audit");

const repoRoot = path.resolve(__dirname, "..");

for (const relPath of [
  "src/truth/project_truth_audit.js",
  "src/truth/code_runtime_map.js",
  "src/truth/change_workflow_simulator.js",
  "src/truth/parity_audit.js",
]) {
  assert.ok(fs.existsSync(path.join(repoRoot, relPath)), `${relPath} must exist`);
}

const truth = buildProjectTruthAudit({ repoRoot });
assert.equal(truth.version, "test-mcp-internal-truth-audit-v1");
assert.equal(truth.read_only, true);
assert.equal(truth.connector_visible, false);
assert.equal(truth.status, "ok", JSON.stringify(truth.findings, null, 2));
assert.equal(truth.current.current_working_course, EXPECTED.current_working_course);
assert.equal(truth.current.next_primary, EXPECTED.next_primary);
assert.equal(truth.current.next_secondary, EXPECTED.next_secondary);
assert.equal(EXPECTED.next_primary, "stage8_53a-internal-truth-tools-parity-preflight");
assert.equal(EXPECTED.next_secondary, "stage8_53b-server-entrypoint-split");

const runtimeMap = buildCodeRuntimeMap({ repoRoot });
assert.equal(runtimeMap.version, "test-mcp-internal-code-runtime-map-v1");
assert.equal(runtimeMap.read_only, true);
assert.equal(runtimeMap.connector_visible, false);
assert.equal(runtimeMap.status, "ok", JSON.stringify(runtimeMap.missing, null, 2));
assert.ok(runtimeMap.runtime_entrypoints.some((entry) => entry.file === "server.js"));
assert.ok(runtimeMap.planned_truth_modules.includes("src/truth/project_truth_audit.js"));
assert.ok(runtimeMap.guards.includes("_tests/smoke_truth_parity_internal.js"));

assert.equal(classifyChange(["src/stage_metadata.js"]), "runtime_status_restart_required");
assert.equal(classifyChange(["server.js"]), "runtime_restart_required");
assert.equal(classifyChange(["_workflow/WORKING_COURSE.md"]), "repo_only");
assert.equal(classifyChange(["src/truth/project_truth_audit.js"]), "repo_or_internal_source");
assert.equal(classifyChange(["src/truth/project_truth_audit.js"], { tool_surface_change: true }), "runtime_with_connector_refresh");

const workflow = simulateChangeWorkflow(["src/stage_metadata.js"]);
assert.equal(workflow.classification, "runtime_status_restart_required");
assert.ok(workflow.workflow.includes("restart TEST MCP for live stage metadata truth"));
assert.ok(workflow.workflow.includes("validate current_working_course and fingerprints"));

const parity = buildParityAudit();
assert.equal(parity.version, "test-mcp-internal-parity-audit-v2");
assert.equal(parity.read_only, true);
assert.equal(parity.connector_visible, false);
assert.equal(parity.status, "ok", JSON.stringify(parity.findings, null, 2));
assert.deepEqual(REQUIRED_GPT_MCP_MECHANISMS, [
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
]);

const serverText = fs.readFileSync(path.join(repoRoot, "server.js"), "utf8");
assert.ok(!serverText.includes("project_truth_audit"), "Stage 8 / Step 53a must not add connector-visible truth tools to server.js");
assert.ok(!serverText.includes("test_project_truth_audit"), "Stage 8 / Step 53a must remain internal-only");

console.log("smoke_truth_parity_internal ok");
