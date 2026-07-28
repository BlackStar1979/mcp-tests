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
  ["_workflow", "_diagnostics", "DIRECTORY.md"],
  ["_workflow", "operator_decisions", "DIRECTORY.md"],
  ["_workflow", "NORTHSTAR.md"],
  ["_workflow", "STATE.md"],
  ["_workflow", "READINESS.md"],
  ["_workflow", "ROADMAP.md"],
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
const workflowState = JSON.parse(read("_workflow", "state.json"));
const rootDirectory = read("DIRECTORY.md");
const packageJson = read("package.json");

assert.ok(northstar.includes("Single-route on `/mcp`"));
assert.ok(northstar.includes("Streamable HTTP only"));
assert.ok(stateDoc.includes("Server version: `0.40.0`"));
assert.ok(stateDoc.includes("target connector-visible tools `84`"));
assert.ok(stateDoc.includes("tests_authenticated=267"));
assert.ok(stateDoc.includes("Latest validated authenticated smoke count: `267`"));
assert.ok(stateDoc.includes("`mcp__workbench` is callable again"));
assert.ok(stateDoc.includes("`src/integrations/codebase_memory/DIRECTORY.md`"));
assert.ok(stateDoc.includes("`openai-mcp 1.0.0`"));
assert.ok(stateDoc.includes("`8` successful legacy `initialize` responses"));
assert.ok(stateDoc.includes("`0` `server/discover` entries"));
assert.ok(readiness.includes("## Component maturity"));
assert.ok(readiness.includes("Operator-facing documentation contract"));
assert.ok(readiness.includes("Live and repository counts are aligned at `13 + 71 = 84`"));
assert.ok(readiness.includes("Codebase-Memory bridge and index integrity"));
assert.ok(readiness.includes("live `detect_changes` now exposes exact returned/omitted totals, `bridge_analysis`, and `impact_resolution_reason`"));
assert.ok(readiness.includes("live `ingest_traces` exposes `runtime_edge_creation=not_implemented` and `runtime_edges_created=0`"));
assert.ok(readiness.includes("Manual multi-repo stress records exact per-tool counts"));
assert.ok(readiness.includes("covered `663` calls across all fifteen `cbm_*` tools, including lifecycle `index/delete`"));
assert.ok(readiness.includes("No active CBM integrity blocker remains"));
assert.ok(readiness.includes("the high-churn CBM integration boundary"));
assert.ok(readiness.includes("the high-churn `_workflow/operator_decisions` ledger"));
assert.ok(readiness.includes("the project-local `using-codebase-memory` skill boundary"));
assert.ok(readiness.includes("no missing `DIRECTORY.md` files among the top 20 tracked dirs with churn >= 7"));
assert.ok(readiness.includes("`openai-mcp 1.0.0` with `8` successful legacy `initialize` responses and `0` `server/discover` entries"));
assert.ok(roadmap.includes("## Priority matrix"));
assert.ok(roadmap.includes("Completed stress closeout: `CBM-BRIDGE-SAMPLE-STRESS`"));
assert.ok(roadmap.includes("`COMP-1A` — event-gated current course"));
assert.ok(roadmap.includes("`DOC-2A` — bounded fallback"));
assert.ok(roadmap.includes("the July 27 `openai-mcp 1.0.0` window"));
assert.ok(initializeEvidence.includes("## Live evidence refresh on 2026-07-27"));
assert.ok(initializeEvidence.includes("`8` successful legacy `initialize` responses"));
assert.ok(initializeEvidence.includes("`0` `server/discover` entries"));
assert.ok(initializeEvidence.includes("test child-server audit isolation"));
assert.ok(operatorDecisionsDirectory.includes("Status: active workflow operator decisions directory map"));
assert.ok(operatorDecisionsDirectory.includes("initialize_client_compatibility_evidence.md"));
assert.ok(operatorDecisionsDirectory.includes("This directory is a decision ledger, not the active queue."));
assert.ok(cbmSkillDirectory.includes("Status: active using-codebase-memory skill directory map"));
assert.ok(cbmSkillDirectory.includes("truth boundaries"));
assert.ok(cbmSkillReferencesDirectory.includes("Status: active using-codebase-memory references directory map"));
assert.ok(cbmSkillReferencesDirectory.includes("Per-tool argument, mutation, and caveat reference"));
assert.equal(workflowState.workflow_progress_markers.current_working_course, "initialize-retirement-evidence-wait");
assert.equal(workflowState.workflow_progress_markers.next_primary, "comp-1a-on-fresh-external-client-traffic");
assert.equal(workflowState.workflow_progress_markers.next_secondary, "bounded-doc-orientation-maintenance");

assert.ok(rootDirectory.includes("This top-level map is intentional but not yet exhaustive"));
assert.ok(rootDirectory.includes("npm run docs:directory"));
assert.ok(workflowReadme.includes("`_workflow/NORTHSTAR.md`"));
assert.ok(workflowReadme.includes("`_workflow/ROADMAP.md`"));
assert.ok(workflowIndex.includes("Operator-facing documentation contract"));
assert.ok(workflowIndex.includes("the latest bounded `DOC-2A` passes refreshed the high-churn `_workflow/operator_decisions` ledger map plus the project-local `using-codebase-memory` skill boundary"));
assert.ok(workflowIndex.includes("`_workflow/NORTHSTAR.md`"));
assert.ok(workflowIndex.includes("`current_working_course = initialize-retirement-evidence-wait`"));
assert.ok(workflowIndex.includes("`next_primary = comp-1a-on-fresh-external-client-traffic`"));
assert.ok(workflowIndex.includes("`next_secondary = bounded-doc-orientation-maintenance`"));
assert.ok(rootReadme.includes("## Operator-Facing Documentation"));
assert.ok(packageJson.includes("\"docs:directory\": \"node scripts/generate_directory_docs.js\""));
assert.ok(packageJson.includes("\"docs:directory:audit\": \"node scripts/audit_directory_docs.js\""));

console.log("smoke_operator_contract_docs ok");
