"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const exists = (...parts) => fs.existsSync(path.join(ROOT, ...parts));

for (const rel of [
  ["DIRECTORY.md"],
  ["_workflow", "DIRECTORY.md"],
  ["scripts", "DIRECTORY.md"],
  ["profiles", "DIRECTORY.md"],
  ["src", "DIRECTORY.md"],
  ["src", "integrations", "DIRECTORY.md"],
  ["src", "integrations", "codebase_memory", "DIRECTORY.md"],
  [".agents", "skills", "using-codebase-memory", "DIRECTORY.md"],
  [".agents", "skills", "using-codebase-memory", "references", "DIRECTORY.md"],
  ["tools", "DIRECTORY.md"],
  ["_tests", "DIRECTORY.md"],
  ["_control", "DIRECTORY.md"],
  ["_logs", "DIRECTORY.md"],
  ["docs", "superpowers", "DIRECTORY.md"],
  ["docs", "superpowers", "plans", "DIRECTORY.md"],
  ["docs", "superpowers", "specs", "DIRECTORY.md"],
  ["docs", "CBM_UPSTREAM_ISSUES_201_277_REVIEW.md"],
  ["_workflow", "_diagnostics", "DIRECTORY.md"],
  ["_workflow", "operator_decisions", "DIRECTORY.md"],
  ["_workflow", "NORTHSTAR.md"],
  ["_workflow", "STATE.md"],
  ["_workflow", "READINESS.md"],
  ["_workflow", "ROADMAP.md"],
  ["_workflow", "operator_decisions", "mcp_official_sdk_v2_interop_closeout.md"],
]) {
  assert.equal(exists(...rel), true, `missing required documentation file: ${rel.join("/")}`);
}

const workflowReadme = read("_workflow", "README.md");
const workflowIndex = read("_workflow", "ACTIVE_WORKFLOW_INDEX.md");
const rootReadme = read("README.md");
const northstar = read("_workflow", "NORTHSTAR.md");
const stateDoc = read("_workflow", "STATE.md");
const readiness = read("_workflow", "READINESS.md");
const roadmap = read("_workflow", "ROADMAP.md");
const cbmSkillDirectory = read(".agents", "skills", "using-codebase-memory", "DIRECTORY.md");
const cbmSkillReferencesDirectory = read(".agents", "skills", "using-codebase-memory", "references", "DIRECTORY.md");
const operatorDecisionsDirectory = read("_workflow", "operator_decisions", "DIRECTORY.md");
const initializeEvidence = read("_workflow", "operator_decisions", "initialize_client_compatibility_evidence.md");
const officialSdkCloseout = read("_workflow", "operator_decisions", "mcp_official_sdk_v2_interop_closeout.md");
const workflowState = JSON.parse(read("_workflow", "state.json"));
const rootDirectory = read("DIRECTORY.md");
const packageJson = read("package.json");

assert.ok(northstar.includes("Single-route on `/mcp`"));
assert.ok(northstar.includes("Streamable HTTP only"));
assert.ok(stateDoc.includes("Server version: `0.40.0`"));
assert.ok(stateDoc.includes("repository target connector-visible tools `85`"));
assert.ok(stateDoc.includes("tests_authenticated=273"));
assert.ok(stateDoc.includes("Latest validated authenticated smoke count: `273`"));
assert.ok(stateDoc.includes("`mcp__workbench` is callable again"));
assert.ok(stateDoc.includes("`src/integrations/codebase_memory/DIRECTORY.md`"));
assert.ok(stateDoc.includes("`codex-mcp-client 0.146.0-alpha.9.2`"));
assert.ok(stateDoc.includes("`2` matching legacy entries"));
assert.ok(stateDoc.includes("`0` `server/discover` entries"));
assert.ok(readiness.includes("## Component maturity"));
assert.ok(readiness.includes("Operator-facing documentation contract"));
assert.ok(readiness.includes("Repository target is `13 + 72 = 85`"));
assert.ok(readiness.includes("Codebase-Memory bridge and index integrity"));
assert.ok(readiness.includes("`detect_changes` exposes exact totals and impact metadata"));
assert.ok(readiness.includes("`ingest_traces` exposes runtime-edge status"));
assert.ok(readiness.includes("strict stress run covered `663` calls across all fifteen `cbm_*` tools with `instability=[]`"));
assert.ok(readiness.includes("snippet source-integrity validation"));
assert.ok(readiness.includes("Live `get_code_snippet` recovered verified `searchIndex` lines `1073-1084`"));
assert.ok(readiness.includes("incorrect native lines `898-909`"));
assert.ok(readiness.includes("No active CBM integrity blocker remains"));
assert.ok(readiness.includes("Hermetic official `@modelcontextprotocol/client@2.0.0` coverage"));
assert.ok(readiness.includes("process-restart recovery of the registered client plus active tokens from SQLite"));
assert.ok(readiness.includes("legacy-path refresh-token rotation after that restart and an access rejection"));
assert.ok(readiness.includes("the high-churn CBM integration boundary"));
assert.ok(readiness.includes("the high-churn `_workflow/operator_decisions` ledger"));
assert.ok(readiness.includes("the project-local `using-codebase-memory` skill boundary"));
assert.ok(readiness.includes("the `docs/superpowers` plan/spec support boundary"));
assert.ok(readiness.includes("no missing `DIRECTORY.md` files among the top 25 tracked dirs with churn >= 5"));
assert.ok(readiness.includes("upstream reviews cover ordinals 1-277"));
assert.ok(readiness.includes("the local skill routes documentation/workflow questions to the knowledge index"));
assert.ok(readiness.includes("`codex-mcp-client 0.146.0-alpha.9.2`, with `2` matching legacy entries and `0` `server/discover` entries"));
assert.ok(roadmap.includes("## Priority matrix"));
assert.ok(roadmap.includes("Completed stress closeout: `CBM-BRIDGE-SAMPLE-STRESS`"));
assert.ok(roadmap.includes("Completed memory activation: `MEM-1-LIVE`"));
assert.ok(roadmap.includes("`COMP-1A` — event-gated protocol course"));
assert.ok(roadmap.includes("`OPS-1A` — operational E2E quality package"));
assert.ok(roadmap.includes("`DOC-2A` — bounded fallback"));
assert.ok(roadmap.includes("the August 2 operational `codex-mcp-client 0.146.0-alpha.9.2` sample"));
assert.ok(initializeEvidence.includes("## Live evidence refresh on 2026-07-27"));
assert.ok(initializeEvidence.includes("## Live evidence refresh on 2026-07-28"));
assert.ok(initializeEvidence.includes("`--latest-entry-window`"));
assert.ok(initializeEvidence.includes("`codex-mcp-client 0.146.0-alpha.3.1`"));
assert.ok(initializeEvidence.includes("`2` successful legacy `initialize` responses in the selected window"));
assert.ok(initializeEvidence.includes("`8` successful legacy `initialize` responses"));
assert.ok(initializeEvidence.includes("`0` `server/discover` entries"));
assert.ok(initializeEvidence.includes("test child-server audit isolation"));
assert.ok(initializeEvidence.includes("## Live evidence refresh on 2026-08-02"));
assert.ok(officialSdkCloseout.includes("@modelcontextprotocol/client@2.0.0"));
assert.ok(officialSdkCloseout.includes("`7 public + 272 authenticated`"));
assert.ok(officialSdkCloseout.includes("## Authenticated OAuth21 extension"));
assert.ok(officialSdkCloseout.includes("production port `3008`: not touched"));
assert.ok(operatorDecisionsDirectory.includes("Status: active workflow operator decisions directory map"));
assert.ok(operatorDecisionsDirectory.includes("initialize_client_compatibility_evidence.md"));
assert.ok(operatorDecisionsDirectory.includes("This directory is a decision ledger, not the active queue."));
assert.ok(cbmSkillDirectory.includes("Status: active using-codebase-memory skill directory map"));
assert.ok(cbmSkillDirectory.includes("truth boundaries"));
assert.ok(cbmSkillReferencesDirectory.includes("Status: active using-codebase-memory references directory map"));
assert.ok(cbmSkillReferencesDirectory.includes("Per-tool argument, mutation, and caveat reference"));
assert.equal(workflowState.workflow_progress_markers.current_working_course, "operational-e2e-quality");
assert.equal(workflowState.workflow_progress_markers.next_primary, "ops-1a-operational-e2e-coverage-matrix");
assert.equal(workflowState.workflow_progress_markers.next_secondary, "comp-1a-on-fresh-external-client-traffic");

assert.ok(rootDirectory.includes("This top-level map is intentional but not yet exhaustive"));
assert.ok(rootDirectory.includes("npm run docs:directory"));
assert.ok(read("docs", "DIRECTORY.md").includes("CBM_UPSTREAM_ISSUES_201_277_REVIEW.md"));
assert.ok(workflowReadme.includes("`_workflow/NORTHSTAR.md`"));
assert.ok(workflowReadme.includes("`_workflow/ROADMAP.md`"));
assert.ok(workflowIndex.includes("Operator-facing documentation contract"));
assert.ok(workflowIndex.includes("the latest bounded `DOC-2A` passes refreshed the high-churn `_workflow/operator_decisions` ledger map, the project-local `using-codebase-memory` skill boundary, and the `docs/superpowers` plan/spec support boundary"));
assert.ok(workflowIndex.includes("no missing `DIRECTORY.md` files among the top 25 tracked dirs with churn >= 5"));
assert.ok(workflowIndex.includes("routes documentation/workflow questions to the dependency-free knowledge index"));
assert.ok(workflowIndex.includes("`_workflow/NORTHSTAR.md`"));
assert.ok(workflowIndex.includes("`current_working_course = operational-e2e-quality`"));
assert.ok(workflowIndex.includes("`next_primary = ops-1a-operational-e2e-coverage-matrix`"));
assert.ok(workflowIndex.includes("`next_secondary = comp-1a-on-fresh-external-client-traffic`"));
assert.ok(rootReadme.includes("## Operator-Facing Documentation"));
assert.ok(packageJson.includes("\"docs:directory\": \"node scripts/generate_directory_docs.js\""));
assert.ok(packageJson.includes("\"docs:directory:audit\": \"node scripts/audit_directory_docs.js\""));

console.log("smoke_operator_contract_docs ok");
