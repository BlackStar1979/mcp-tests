"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  assertCurrentRuntimeStartIdentity,
  latestAuthenticatedSmokeCount,
  latestFullSmokeToken,
} = require("./helpers/workflow_baseline");

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
  ["src", "integrations", "codebase_memory", "contracts", "DIRECTORY.md"],
  ["_workflow", "historical", "progress_state_dependent_validators", "DIRECTORY.md"],
  ["_workflow", "historical", "progress_state_dependent_validators", "_tests", "DIRECTORY.md"],
  ["_workflow", "historical", "progress_state_dependent_validators", "_workflow", "DIRECTORY.md"],
  ["_workflow", "historical", "progress_state_dependent_validators", "_workflow", "scripts", "DIRECTORY.md"],
  [".agents", "skills", "using-codebase-memory", "DIRECTORY.md"],
  [".agents", "skills", "using-codebase-memory", "references", "DIRECTORY.md"],
  ["tools", "DIRECTORY.md"],
  ["_tests", "DIRECTORY.md"],
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
  ["_workflow", "operator_decisions", "mcp_tasks_process_adapter_closeout.md"],
  ["_workflow", "operator_decisions", "process_artifacts_closeout.md"],
  ["_workflow", "operator_decisions", "oauth_cimd_closeout.md"],
  ["_workflow", "operator_decisions", "mrtr_conformance_closeout.md"],
  ["_workflow", "operator_decisions", "mrtr_runtime_closeout.md"],
  ["_workflow", "operator_decisions", "observability_live_trail_acceptance.md"],
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
const tasksCloseout = read("_workflow", "operator_decisions", "mcp_tasks_process_adapter_closeout.md");
const traceCloseout = read("_workflow", "operator_decisions", "w3c_trace_context_closeout.md");
const artifactsCloseout = read("_workflow", "operator_decisions", "process_artifacts_closeout.md");
const cimdCloseout = read("_workflow", "operator_decisions", "oauth_cimd_closeout.md");
const mrtrCloseout = read("_workflow", "operator_decisions", "mrtr_conformance_closeout.md");
const mrtrRuntimeCloseout = read("_workflow", "operator_decisions", "mrtr_runtime_closeout.md");
const observabilityCloseout = read("_workflow", "operator_decisions", "observability_live_trail_acceptance.md");
const processPersistenceAcceptance = read("_workflow", "operator_decisions", "process_job_persistence_live_acceptance.md");
const workflowState = JSON.parse(read("_workflow", "state.json"));
const eventCatalog = JSON.parse(read("SERVER_EVENT_CATALOG_SPEC.json"));
const rootDirectory = read("DIRECTORY.md");
const packageJson = read("package.json");

assert.ok(northstar.includes("Single-route on `/mcp`"));
assert.ok(northstar.includes("Streamable HTTP only"));
assert.ok(stateDoc.includes("Server version: `0.40.0`"));
assert.ok(stateDoc.includes("repository target connector-visible tools `98`"));
assert.ok(stateDoc.includes(latestFullSmokeToken));
assert.ok(stateDoc.includes(`Latest validated authenticated smoke count: \`${latestAuthenticatedSmokeCount}\``));
assert.ok(stateDoc.includes("`mcp__workbench` is callable again"));
assert.ok(stateDoc.includes("`src/integrations/codebase_memory/DIRECTORY.md`"));
assert.ok(stateDoc.includes("`codex-mcp-client 0.148.0-alpha.9`"));
assert.ok(stateDoc.includes("`3` successful legacy `initialize` entries"));
assert.ok(stateDoc.includes("`0` `server/discover` entries"));
assert.ok(readiness.includes("## Component maturity"));
assert.ok(readiness.includes("Operator-facing documentation contract"));
assert.ok(readiness.includes("Governance correctly detected and closed the POL-1A-DLP schema delta"));
assert.ok(readiness.includes("No active connector-surface blocker remains"));
assert.ok(readiness.includes("`SEP-2164` and `SEP-1303` remain live accepted"));
assert.ok(readiness.includes("Production MRTR (`SEP-2322`) is now live-loaded as the generic fresh-consent primitive"));
assert.ok(readiness.includes("capability-adaptive operator authorization is repository-implemented and regression-GREEN; complete controlled restart and semantic live acceptance"));
assert.ok(readiness.includes("| SURF-1 | Connector-visible surface governance | 4/4 |"));
assert.ok(readiness.includes("| PROC-1 | Process execution reliability | 4/4 |"));
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
assert.ok(readiness.includes("All `68/68` directories containing tracked project files have `DIRECTORY.md`"));
assert.ok(readiness.includes("the active CBM native-contract boundary"));
assert.ok(readiness.includes("the retired progress-state validator snapshot"));
assert.ok(readiness.includes("`generate_directory_docs.js --check` is non-mutating and fail-closed"));
assert.ok(readiness.includes("duplicate dynamic control-plane targets are eliminated"));
assert.ok(readiness.includes("Generator check, repo-wide audit, operator-contract guard, and full smoke remain green"));
assert.ok(readiness.includes("upstream reviews cover ordinals 1-277"));
assert.ok(readiness.includes("the local skill routes documentation/workflow questions to the knowledge index"));
assert.ok(readiness.includes("`codex-mcp-client 0.148.0-alpha.9` as `initialize_only`, with `3` successful legacy `initialize` entries and `0` `server/discover` entries"));
assert.ok(roadmap.includes("## Priority matrix"));
assert.ok(roadmap.includes("Completed stress closeout: `CBM-BRIDGE-SAMPLE-STRESS`"));
assert.ok(roadmap.includes("Completed memory activation: `MEM-1-LIVE`"));
assert.ok(roadmap.includes("Completed execution identity: `PROC-1B-R2`"));
assert.ok(roadmap.includes("Completed MCP Tasks foundation: `MCP-TASKS-PROCESS-ADAPTER`"));
assert.ok(roadmap.includes("Completed operational E2E package: `OPS-1A`"));
assert.ok(roadmap.includes("Completed process execution: `PROC-1A`"));
assert.ok(roadmap.includes("Completed production MRTR runtime: `pol-1a-mrtr-runtime`"));
assert.ok(roadmap.includes("`COMP-1A` — event-gated protocol evidence"));
assert.ok(roadmap.includes("the August 17 operational `codex-mcp-client 0.148.0-alpha.9` sample"));
assert.ok(processPersistenceAcceptance.includes("Status: GREEN / LIVE / ACCEPTED"));
assert.ok(processPersistenceAcceptance.includes("manual-1786292134573"));
assert.ok(processPersistenceAcceptance.includes("recovered_after_restart=true"));
assert.ok(processPersistenceAcceptance.includes("does not persist command arguments or environment values"));
assert.ok(processPersistenceAcceptance.includes("never replays commands after restart"));
assert.ok(processPersistenceAcceptance.includes("owner-scoped transactional idempotency"));
assert.ok(processPersistenceAcceptance.includes("keyed HMAC"));
assert.ok(initializeEvidence.includes("## Live evidence refresh on 2026-07-27"));
assert.ok(initializeEvidence.includes("## Live evidence refresh on 2026-07-28"));
assert.ok(initializeEvidence.includes("`--latest-entry-window`"));
assert.ok(initializeEvidence.includes("`codex-mcp-client 0.146.0-alpha.3.1`"));
assert.ok(initializeEvidence.includes("`2` successful legacy `initialize` responses in the selected window"));
assert.ok(initializeEvidence.includes("`8` successful legacy `initialize` responses"));
assert.ok(initializeEvidence.includes("`0` `server/discover` entries"));
assert.ok(initializeEvidence.includes("test child-server audit isolation"));
assert.ok(initializeEvidence.includes("## Live evidence refresh on 2026-08-02"));
assert.ok(initializeEvidence.includes("## Live evidence refresh on 2026-08-16"));
assert.ok(initializeEvidence.includes("`codex-mcp-client 0.147.0-alpha.6.6`"));
assert.ok(initializeEvidence.includes("## Live evidence refresh on 2026-08-17"));
assert.ok(initializeEvidence.includes("`codex-mcp-client 0.148.0-alpha.9`"));
assert.ok(initializeEvidence.includes("`3` successful legacy `initialize` entries"));
assert.ok(initializeEvidence.includes("`openai-mcp 1.0.0`"));
assert.ok(initializeEvidence.includes("`blocked_by_operational_initialize_clients`"));
assert.ok(officialSdkCloseout.includes("@modelcontextprotocol/client@2.0.0"));
assert.ok(officialSdkCloseout.includes("`7 public + 272 authenticated`"));
assert.ok(officialSdkCloseout.includes("## Authenticated OAuth21 extension"));
assert.ok(officialSdkCloseout.includes("production port `3008`: not touched"));
assert.ok(tasksCloseout.includes("Status: repo-validated, live-loaded and live-accepted"));
assert.ok(tasksCloseout.includes("Clean-history GitHub Actions run `31784712342`"));
assert.ok(tasksCloseout.includes("`TRACE-CONTEXT` is now the highest-leverage"));
assert.ok(tasksCloseout.includes("server_start_id = 2026-08-16T19:04:37.288Z"));
assert.ok(traceCloseout.includes("Status: repo-validated, live-loaded and live-accepted"));
assert.ok(traceCloseout.includes("`PROCESS-ARTIFACTS` is now the highest-leverage"));
assert.ok(traceCloseout.includes("Raw baggage and raw tracestate are never persisted"));
assert.ok(traceCloseout.includes("tests_authenticated=298"));
assert.ok(traceCloseout.includes("8dd0f95cfb76cfa719af99c69bc8e2ae"));
assert.ok(artifactsCloseout.includes("Status: repo-validated, live-loaded and live-accepted"));
assert.ok(artifactsCloseout.includes("`CIMD` is now the highest-leverage"));
assert.ok(artifactsCloseout.includes("tests_authenticated=301"));
assert.ok(artifactsCloseout.includes("mcp-artifact://process/<opaque-id>"));
assert.ok(cimdCloseout.includes("Status: repo-validated, live-loaded and live-accepted"));
assert.ok(cimdCloseout.includes("draft-ietf-oauth-client-id-metadata-document-02"));
assert.ok(cimdCloseout.includes("Clean-history validation run `31959846622`"));
assert.ok(cimdCloseout.includes("tests_authenticated=304"));
assert.ok(cimdCloseout.includes("`MRTR` is now the highest-leverage"));
assert.ok(cimdCloseout.includes("cimd_special_use_ip"));
assert.ok(mrtrCloseout.includes("Status: repo-validated, fixture-only, runtime-nonapplicable"));assert.ok(mrtrCloseout.includes("Clean-history validation run `31963602072`"));
assert.ok(mrtrCloseout.includes("tests_authenticated=305"));
assert.ok(mrtrCloseout.includes("`resultType: \"complete\"`"));
assert.ok(mrtrCloseout.includes("`COMP-1A` refresh remains blocked"));
assert.ok(mrtrRuntimeCloseout.includes("Status: live-accepted, loaded-dormant"));
assert.ok(mrtrRuntimeCloseout.includes("manual-1787079823223"));
assert.ok(mrtrRuntimeCloseout.includes("server_start_id: 2026-08-18T19:03:44.754Z"));
assert.ok(mrtrRuntimeCloseout.includes("combined_fingerprint: 93721a82a339f9d6"));
assert.ok(mrtrRuntimeCloseout.includes("POL-1A-CONSENT"));
assert.ok(operatorDecisionsDirectory.includes("Status: active workflow operator decisions directory map"));
assert.ok(operatorDecisionsDirectory.includes("initialize_client_compatibility_evidence.md"));
assert.ok(operatorDecisionsDirectory.includes("run_process_sync_ceiling.md"));
assert.ok(operatorDecisionsDirectory.includes("oauth_cimd_closeout.md"));
assert.ok(operatorDecisionsDirectory.includes("mrtr_conformance_closeout.md"));
assert.ok(operatorDecisionsDirectory.includes("mrtr_runtime_closeout.md"));
assert.ok(operatorDecisionsDirectory.includes("observability_live_trail_acceptance.md"));
assert.ok(observabilityCloseout.includes("Status: GREEN / LIVE ACCEPTED"));
assert.ok(observabilityCloseout.includes("followup_traffic_without_fresh_entry = true"));
assert.ok(readiness.includes("| OBS-1 | Server-side request/response observability | 4/4 |"));
assert.ok(operatorDecisionsDirectory.includes("This directory is a decision ledger, not the active queue."));
assert.ok(cbmSkillDirectory.includes("Status: active using-codebase-memory skill directory map"));
assert.ok(cbmSkillDirectory.includes("truth boundaries"));
assert.ok(cbmSkillReferencesDirectory.includes("Status: active using-codebase-memory references directory map"));
assert.ok(cbmSkillReferencesDirectory.includes("Per-tool argument, mutation, and caveat reference"));
assert.equal(workflowState.workflow_progress_markers.current_working_course, "protocol-capability-module-convergence");
assert.equal(workflowState.workflow_progress_markers.next_primary, "pol-1a-prompt-content");
assert.equal(workflowState.workflow_progress_markers.next_secondary, "pol-1b");
assert.ok(readiness.includes("| POL-1 | Policy coverage convergence | 2/4 |"));
assert.equal(workflowState.audit_events_spec.event_count, eventCatalog.events.length);

assertCurrentRuntimeStartIdentity(workflowState);
assert.equal(workflowState.current_runtime_truth.oauth21_3008.p0_p3_live, true);
assert.ok(tasksCloseout.includes("737cdc8b97ec1e966823dc2566eb7d5cd221e9b6"));
assert.ok(mrtrCloseout.includes("runtime acceptance is non-applicable rather than pending"));
assert.ok(rootDirectory.includes("Every directory containing tracked project files has a `DIRECTORY.md` map"));
assert.ok(rootDirectory.includes("generate_directory_docs.js --check"));
assert.ok(rootDirectory.includes("npm run docs:directory"));
assert.ok(read("docs", "DIRECTORY.md").includes("CBM_UPSTREAM_ISSUES_201_277_REVIEW.md"));
assert.ok(read("docs", "DIRECTORY.md").includes("PROCESS_RUNNER_CONSUMER_INSTRUCTION.md"));
assert.ok(workflowReadme.includes("`_workflow/NORTHSTAR.md`"));
assert.ok(workflowReadme.includes("`_workflow/ROADMAP.md`"));
assert.ok(workflowIndex.includes("Operator-facing documentation contract"));
assert.ok(workflowIndex.includes("A fresh `index_status` is the single-call planning view"));
assert.ok(readiness.includes("| DOC-1 | Operator-facing documentation contract | 4/4 |"));
assert.ok(readiness.includes("No active planning-orientation blocker remains"));
assert.ok(workflowIndex.includes("`DOC-2` is accepted at `4/4`"));
assert.ok(workflowIndex.includes("all `68/68` directories containing tracked files"));
assert.ok(workflowIndex.includes("routes documentation/workflow questions to the dependency-free knowledge index"));
assert.ok(workflowIndex.includes("`_workflow/NORTHSTAR.md`"));
assert.ok(workflowIndex.includes("`current_working_course = protocol-capability-module-convergence`"));
assert.ok(workflowIndex.includes("`next_primary = pol-1a-prompt-content`"));
assert.ok(workflowIndex.includes("`next_secondary = pol-1b`"));
assert.ok(readiness.includes("| OPS-1 | Operational E2E and soak coverage | 4/4 |"));
assert.ok(roadmap.includes("`OPS-1B` live SFTP boundary — accepted"));
assert.ok(rootReadme.includes("## Operator-Facing Documentation"));
assert.ok(packageJson.includes("\"docs:directory\": \"node scripts/generate_directory_docs.js\""));
assert.ok(packageJson.includes("\"docs:directory:audit\": \"node scripts/audit_directory_docs.js\""));

console.log("smoke_operator_contract_docs ok");
