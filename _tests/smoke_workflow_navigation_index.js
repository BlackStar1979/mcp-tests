"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

const index = read("_workflow", "ACTIVE_WORKFLOW_INDEX.md");
const canon = read("_workflow", "WORKFLOW_CANON.md");
const state = JSON.parse(read("_workflow", "state.json"));
const smokeScripts = JSON.parse(read("_tests", "run_all_smoke_scripts.json"));

assert.ok(index.includes("Status: active navigation index"));
assert.ok(index.includes("Do not create a separate master document."));
assert.ok(index.includes("Do not infer active work from historical plan files"));
assert.ok(index.includes("## Active remaining work queue"));
assert.ok(index.includes("Historical records remain traceability evidence, not the active queue."));
assert.ok(index.includes("`_workflow/control_plane/snapshots/**` is archival evidence only"));
assert.ok(index.includes("Execute one coherent `_tests`/`_workflow` rename-normalization migration package before any push attempt"));
assert.ok(index.includes("adjacent_sep_watchlist_review.md"));
assert.ok(index.includes("repo_hygiene_commit_scope_triage.md"));
assert.ok(index.includes("Completed commit-scope isolation review and confirmed that no safe narrow standalone push exists yet"));
assert.ok(index.includes("Completed rename-normalization package scoping and separated direct rename-equivalent pairs"));
assert.ok(index.includes("Recently completed:"));
assert.ok(index.includes("Completed repo hygiene triage and confirmed that push is not safe yet"));
assert.ok(index.includes("adjacent_runtime_contract_sep_triage.md"));
assert.ok(index.includes("auth_security_adjacent_sep_triage.md"));
assert.ok(index.includes("Reviewed the adjacent/auth watchlist and intentionally avoided opening speculative new ledgers"));
assert.ok(index.includes("Triaged the 19 adjacent runtime-contract Final SEPs"));
assert.ok(index.includes("Triaged the 7 auth/security-adjacent Final SEPs"));
assert.ok(index.includes("Final `state/handle/*` fate decision: explicit state handles remain a tool-design pattern, but route-level `state/handle/*` methods are not part of the surviving `/mcp` end state."));
assert.ok(index.includes("Bounded runtime package to retire prototype-only `subscriptions/listen` / push debt and align `/mcp` freshness to the pull-only contract."));
assert.ok(index.includes("Implementation scoping for replacement behavior and coverage required before `/mcp/sessionless` removal."));
assert.ok(index.includes("Final initialize-retirement boundary decision for the surviving `/mcp` route."));
assert.ok(index.includes("Teardown package for `GET /mcp` SSE, `Last-Event-ID`, and stable stream-path replay semantics."));
assert.ok(index.includes("single_route_no_sse_streamable_http_target_plan.md"));

assert.ok(canon.includes("Latest validated public section count: `7`"));
assert.ok(canon.includes("Latest validated authenticated smoke count: `209`"));
assert.ok(canon.includes("## 3A. Current active work queue"));
assert.ok(canon.includes("Snapshot clarification: `_workflow/control_plane/snapshots/**` is archival evidence only."));
assert.ok(canon.includes("Workflow file count is not a project-progress metric."));
assert.ok(canon.includes("Earlier checkpoint-specific implementation boundaries remain historical evidence unless reaffirmed by later records."));
assert.ok(canon.includes("one streamable-HTTP-only route with no SSE"));
assert.ok(canon.includes("active interpretation layer for the destination architecture"));
assert.ok(canon.includes("GET teardown clarification"));
assert.ok(canon.includes("Initialize-retirement boundary clarification"));
assert.ok(canon.includes("Replacement-coverage clarification"));
assert.ok(canon.includes("Pull-only subscriptions clarification"));
assert.ok(canon.includes("Pull-only runtime-package clarification"));
assert.ok(canon.includes("State-handle fate clarification"));
assert.ok(canon.includes("Adjacent runtime-contract SEP triage green"));
assert.ok(canon.includes("Auth/security adjacent SEP triage green"));
assert.ok(canon.includes("Adjacent/auth watchlist review green"));
assert.ok(canon.includes("Repo hygiene commit-scope triage green"));
assert.ok(canon.includes("Repo hygiene commit-scope isolation green"));
assert.ok(canon.includes("Tests/workflow rename-normalization package scoping green"));

for (const stale of [
  "Latest validated public section count: `8`",
  "Latest validated authenticated smoke count after HTTP boundary guard: `116`",
  "Workflow memory compaction: `_workflow` reduced from 425 files to 45 files",
  "## 3A. Active Streamable HTTP / Sampling / OAuth workflow",
  "Active roadmap: `_workflow/STREAMABLE_HTTP_SAMPLING_OAUTH_WORKFLOW.md`",
  "Current workflow preparation status: `ready_streamable_http_workflow_plan`",
  "Stable `/mcp` and `/mcp/sessionless` coexistence regression hardening.",
]) {
  assert.equal(canon.includes(stale), false, stale);
}

assert.equal(state.schema_version, "workflow-state-spec-map-v2");
assert.equal(state.status, "compact_orientation_map_not_progress_log");
assert.ok(!Object.hasOwn(state, "post_stage13_hygiene"));
assert.equal(state.active_target_direction.single_route_only, true);
assert.equal(state.active_target_direction.sse_allowed_in_end_state, false);
assert.equal(state.active_target_direction.post_accept_cleanup_record, "_workflow/operator_decisions/keep_mcp_post_accept_json_only_cleanup.md");
assert.equal(state.active_target_direction.stable_post_mcp_response_mode, "json_only");

console.log("smoke_workflow_navigation_index ok");
