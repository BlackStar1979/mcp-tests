const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const inventoryPath = path.join(ROOT, "_workflow", "sessionless_inventory.json");
const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));

assert.equal(inventory.schema_version, "stage14_6-sep-driven-sessionless-inventory-v1");
assert.equal(inventory.status, "sep_driven_living_checklist_no_runtime_change");
assert.ok(Array.isArray(inventory.authority_chain));
for (const required of [
  "_workflow/README.md",
  "_workflow/ACTIVE_WORKFLOW_INDEX.md",
  "_workflow/state.json",
  "_workflow/WORKFLOW_CANON.md",
  "_workflow/operator_decisions/post_stage6_operator_decisions_2026-06-21.md",
  "_workflow/sessionless_inventory.json",
]) {
  assert.ok(inventory.authority_chain.includes(required), `missing authority chain item: ${required}`);
}

assert.equal(inventory.source_verification.last_verified_date, "2026-06-29");
const seps = new Set(inventory.source_verification.tracked_final_seps.map((item) => item.sep));
for (const sep of ["SEP-2549", "SEP-2567", "SEP-2575", "SEP-2577", "SEP-2596"]) {
  assert.ok(seps.has(sep), `missing tracked SEP: ${sep}`);
}
for (const item of inventory.source_verification.tracked_final_seps) {
  assert.equal(item.status, "Final", `${item.sep} must be tracked as Final`);
  assert.match(item.url, /^https:\/\/modelcontextprotocol\.io\/seps\//, `${item.sep} must cite official SEP URL`);
}

const ledger = new Map(inventory.deprecation_ledger.map((item) => [item.feature_id, item]));
for (const required of [
  "initialize_handshake",
  "mcp_session_id_header",
  "session_store",
  "get_mcp_sse_stream",
  "subscriptions_listen",
  "delete_mcp_teardown",
  "request_cancellation",
  "resumable_sse_last_event_id",
  "list_results_ttl_cache_scope",
  "dynamic_list_lifecycle_hotplug",
  "roots_sampling_logging_deprecation",
  "feature_lifecycle_deprecation_policy",
  "restart_resilience",
  "runtime_policy_scope_matrix",
]) {
  assert.ok(ledger.has(required), `missing ledger item: ${required}`);
}

const allowedStatus = new Set(inventory.status_values);
const allowedLifecycle = new Set(inventory.feature_lifecycle_values);
for (const item of inventory.deprecation_ledger) {
  assert.ok(item.feature_id, "feature_id required");
  assert.ok(Array.isArray(item.sep_sources) && item.sep_sources.length > 0, `${item.feature_id} needs sep_sources`);
  assert.ok(allowedLifecycle.has(item.target_lifecycle), `${item.feature_id} has invalid lifecycle ${item.target_lifecycle}`);
  assert.ok(allowedStatus.has(item.implementation_status), `${item.feature_id} has invalid status ${item.implementation_status}`);
  assert.ok(item.migration_path && typeof item.migration_path === "string", `${item.feature_id} needs migration_path`);
  assert.ok(Array.isArray(item.checklist) && item.checklist.length > 0, `${item.feature_id} needs checklist`);
  for (const check of item.checklist) {
    assert.ok(check.item, `${item.feature_id} checklist item missing text`);
    assert.ok(allowedStatus.has(check.status), `${item.feature_id} checklist invalid status ${check.status}`);
  }
}

assert.deepEqual(ledger.get("initialize_handshake").sep_sources, ["SEP-2575", "SEP-2596"]);
assert.ok(ledger.get("mcp_session_id_header").sep_sources.includes("SEP-2567"));
assert.ok(ledger.get("list_results_ttl_cache_scope").sep_sources.includes("SEP-2549"));
assert.ok(ledger.get("roots_sampling_logging_deprecation").sep_sources.includes("SEP-2577"));
assert.equal(ledger.get("restart_resilience").implementation_status, "partial");
assert.ok(JSON.stringify(ledger.get("restart_resilience")).includes("SERVER_RUNTIME_TOPOLOGY_SPEC.json"));
assert.match(ledger.get("restart_resilience").repo_current_model, /3008 OAuth21/);
assert.match(ledger.get("restart_resilience").repo_current_model, /3009 false closeout corrected/);

assert.equal(inventory.recommended_next.some((item) => item.includes("restart authority before touching")), false);
assert.ok(inventory.recommended_next.some((item) => item.includes("reassess blockers")));
assert.equal(inventory.recommended_next.some((item) => item.includes("Operator should select whether to approve S4 parallel draft/sessionless prototype")), false);
assert.equal(inventory.recommended_next.some((item) => item.includes("If operator does not approve runtime prototype yet, next safe non-runtime step is S3 explicit state handle design rules.")), false);
assert.equal(inventory.recommended_next.some((item) => item.includes("Do not remove current stable-compatible session code before S2 target selection.")), false);
assert.ok(inventory.recommended_next.some((item) => item.includes("migration debt")));
assert.ok(inventory.recommended_next.some((item) => item.includes("SEP-2549 inventory is complete")));
assert.ok(inventory.recommended_next.some((item) => item.includes("transport-session retirement is complete")));
assert.equal(inventory.active_target_contract.record, "_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md");
assert.equal(inventory.active_target_contract.single_route_only, true);
assert.equal(inventory.active_target_contract.sse_allowed_in_end_state, false);
assert.equal(inventory.active_target_contract.dual_route_coexistence_is_target, false);
assert.equal(inventory.active_target_contract.transport_session_retirement_package_record, "_workflow/operator_decisions/keep_mcp_transport_session_retirement_package.md");
assert.equal(inventory.active_target_contract.stable_protocol_sessions, false);
assert.equal(inventory.active_target_contract.post_accept_cleanup_record, "_workflow/operator_decisions/keep_mcp_post_accept_json_only_cleanup.md");
assert.equal(inventory.active_target_contract.get_sse_teardown_record, "_workflow/operator_decisions/keep_mcp_get_sse_teardown.md");
assert.equal(inventory.active_target_contract.stable_post_mcp_response_mode, "json_only");
assert.equal(inventory.active_target_contract.stable_get_mcp_supported, false);
assert.equal(inventory.target_selection_readiness.status, "selected_parallel_track_stable_mcp_preserved");
assert.equal(inventory.target_selection_readiness.record, "_workflow/operator_decisions/sessionless_target_selection_decision.md");
assert.equal(inventory.target_selection_readiness.connector_refresh_required_now, false);
assert.equal(inventory.target_selection_readiness.runtime_restart_required_now, false);
assert.ok(inventory.recommended_next.some((item) => item.includes("tools/list already exposes ttlMs=0 and cacheScope=private")));
assert.ok(inventory.recommended_next.some((item) => item.includes("stricter project target")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Adjacent runtime-contract SEP triage is complete")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Auth/security adjacent SEP triage is complete")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Adjacent/auth watchlist review is complete")));
assert.ok(inventory.recommended_next.some((item) => item.includes("SEP-1303")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Repo cleanup/normalization debt is closed on main")));
assert.ok(inventory.recommended_next.some((item) => item.includes("do not reopen the cleanup blocker")));
assert.equal(inventory.recommended_next.some((item) => item.includes("coexistence hardening")), false);
assert.equal(JSON.stringify(inventory.target_selection_readiness).includes("coexistence regression hardening"), false);
assert.match(ledger.get("subscriptions_listen").repo_current_model, /removed from active runtime/);
assert.equal(ledger.get("subscriptions_listen").target_lifecycle, "operator_non_target");
assert.match(ledger.get("subscriptions_listen").migration_path, /pull-only tools\/list freshness/);
assert.equal(ledger.get("subscriptions_listen").implementation_status, "done");
assert.match(ledger.get("get_mcp_sse_stream").repo_current_model, /returns 405/);
assert.equal(ledger.get("get_mcp_sse_stream").implementation_status, "partial");
assert.equal(ledger.get("get_mcp_sse_stream").checklist.find((item) => item.item === "apply bounded GET teardown on surviving /mcp route").status, "done");
assert.match(ledger.get("mcp_session_id_header").repo_current_model, /no longer depends on MCP-Session-Id/);
assert.equal(ledger.get("mcp_session_id_header").implementation_status, "partial");
assert.equal(ledger.get("mcp_session_id_header").checklist.find((item) => item.item === "retire stable /mcp transport-session header dependence").status, "done");
assert.match(ledger.get("session_store").repo_current_model, /no longer creates or requires transport sessions/);
assert.equal(ledger.get("session_store").checklist.find((item) => item.item === "retire active surviving-route transport-session lifecycle").status, "done");
assert.match(ledger.get("resumable_sse_last_event_id").repo_current_model, /no longer reachable/);
assert.equal(ledger.get("resumable_sse_last_event_id").implementation_status, "partial");
assert.equal(ledger.get("resumable_sse_last_event_id").checklist.find((item) => item.item === "remove stable-route replay reachability").status, "done");
assert.equal(ledger.get("initialize_handshake").checklist.find((item) => item.item === "design parallel stateless mode before removal").status, "done");
assert.equal(ledger.get("initialize_handshake").checklist.find((item) => item.item === "design parallel stateless mode before removal").evidence, "_workflow/operator_decisions/sessionless_target_selection_decision.md");
assert.equal(ledger.get("initialize_handshake").checklist.find((item) => item.item === "retire initialize-created transport sessions on surviving /mcp while keeping legacy initialize as stateless compatibility").status, "done");
assert.equal(ledger.get("subscriptions_listen").checklist.find((item) => item.item === "record final pull-only no-SSE contract for tool-surface freshness on surviving /mcp").status, "done");
assert.equal(ledger.get("subscriptions_listen").checklist.find((item) => item.item === "retire prototype-only subscriptions/listen runtime path and stop advertising tool-list push on active /mcp").status, "done");

assert.equal(inventory.source_verification.official_final_count, 41);
assert.equal(inventory.coverage_summary.total_final_seps, 41);
assert.equal(inventory.coverage_summary.adjacent_runtime_contract, 19);
assert.equal(inventory.coverage_summary.auth_security_adjacent, 7);
assert.equal(inventory.coverage_summary.unclassified, 0);
assert.equal(inventory.adjacent_runtime_contract_triage.record, "_workflow/operator_decisions/adjacent_runtime_contract_sep_triage.md");
assert.equal(inventory.adjacent_runtime_contract_triage.total_final_seps, 19);
assert.deepEqual(inventory.adjacent_runtime_contract_triage.covered_by_existing_runtime_or_specs, ["SEP-2322", "SEP-2260", "SEP-2243", "SEP-2106", "SEP-1577", "SEP-986"]);
assert.deepEqual(inventory.adjacent_runtime_contract_triage.explicit_non_target_or_disabled_now, ["SEP-2663", "SEP-1686", "SEP-1865", "SEP-1699", "SEP-1330", "SEP-1036", "SEP-1034", "SEP-414"]);
assert.deepEqual(inventory.adjacent_runtime_contract_triage.partial_coverage_watchlist, ["SEP-2164", "SEP-1613", "SEP-1319", "SEP-1303", "SEP-973"]);
assert.equal(inventory.auth_security_adjacent_triage.record, "_workflow/operator_decisions/auth_security_adjacent_sep_triage.md");
assert.equal(inventory.auth_security_adjacent_triage.total_final_seps, 7);
assert.deepEqual(inventory.auth_security_adjacent_triage.covered_by_existing_runtime_or_specs, ["SEP-2468", "SEP-2207", "SEP-985"]);
assert.deepEqual(inventory.auth_security_adjacent_triage.explicit_non_target_or_no_current_dependency, ["SEP-1046", "SEP-1024", "SEP-990"]);
assert.deepEqual(inventory.auth_security_adjacent_triage.partial_coverage_watchlist, ["SEP-991"]);
assert.equal(inventory.adjacent_watchlist_review.record, "_workflow/operator_decisions/adjacent_sep_watchlist_review.md");
assert.equal(inventory.adjacent_watchlist_review.no_new_ledger_opened_now, true);
assert.deepEqual(inventory.adjacent_watchlist_review.reopen_first_if_needed, ["SEP-1303"]);
assert.deepEqual(inventory.adjacent_watchlist_review.defer_until_target_surface_exists, ["SEP-2164", "SEP-973"]);
assert.deepEqual(inventory.adjacent_watchlist_review.sufficient_for_current_scope_without_new_ledger, ["SEP-1613", "SEP-1319", "SEP-991"]);
assert.equal(inventory.repo_hygiene_commit_scope_triage.record, "_workflow/operator_decisions/repo_hygiene_commit_scope_triage.md");
assert.equal(inventory.repo_hygiene_commit_scope_triage.push_safe_now, true);
assert.equal(inventory.repo_hygiene_commit_scope_triage.next_step, "no_repo_cleanup_push_blocker_remains");
assert.equal(inventory.repo_hygiene_commit_scope_triage.git_status_entry_count, 2);
assert.equal(inventory.repo_hygiene_commit_scope_triage.git_diff_stat_changed_files, 0);
assert.equal(inventory.repo_hygiene_commit_scope_triage.closeout_head, "aecec58");
assert.equal(inventory.repo_hygiene_commit_scope_triage.closeout_branch, "main");
assert.equal(inventory.repo_hygiene_commit_scope_triage.origin_main_includes_closeout_head, true);
assert.deepEqual(inventory.repo_hygiene_commit_scope_triage.local_only_untracked_paths, [".codebase-memory/", "_workflow/experiments/"]);
assert.equal(inventory.repo_hygiene_commit_scope_isolation.record, "_workflow/operator_decisions/repo_hygiene_commit_scope_isolation.md");
assert.equal(inventory.repo_hygiene_commit_scope_isolation.validated_run_all_ok, true);
assert.equal(inventory.repo_hygiene_commit_scope_isolation.validated_run_all_public_count, 7);
assert.equal(inventory.repo_hygiene_commit_scope_isolation.validated_run_all_tests_authenticated_count, 210);
assert.equal(inventory.repo_hygiene_commit_scope_isolation.git_status_entry_count, 2);
assert.equal(inventory.repo_hygiene_commit_scope_isolation.git_diff_stat_changed_files, 0);
assert.equal(inventory.repo_hygiene_commit_scope_isolation.safe_narrow_commit_available_now, true);
assert.equal(inventory.repo_hygiene_commit_scope_isolation.push_safe_now, true);
assert.equal(inventory.repo_hygiene_commit_scope_isolation.next_step, "no_repo_cleanup_action_required");
assert.equal(inventory.repo_hygiene_commit_scope_isolation.validated_closeout_head, "aecec58");
assert.equal(inventory.repo_hygiene_commit_scope_isolation.origin_main_includes_closeout_head, true);
assert.equal(inventory.tests_workflow_rename_normalization_package.record, "_workflow/operator_decisions/tests_workflow_rename_normalization_package.md");
assert.equal(inventory.tests_workflow_rename_normalization_package.tests_readme_audit, "_tests/RENAME_NORMALIZATION_MIGRATION_AUDIT.md");
assert.equal(inventory.tests_workflow_rename_normalization_package.tests_untracked_additions, 256);
assert.equal(inventory.tests_workflow_rename_normalization_package.tests_tracked_deletions, 248);
assert.equal(inventory.tests_workflow_rename_normalization_package.tests_tracked_modifications, 12);
assert.equal(inventory.tests_workflow_rename_normalization_package.workflow_untracked_additions, 57);
assert.equal(inventory.tests_workflow_rename_normalization_package.workflow_tracked_deletions, 22);
assert.equal(inventory.tests_workflow_rename_normalization_package.workflow_tracked_modifications, 40);
assert.equal(inventory.tests_workflow_rename_normalization_package.combined_untracked_additions, 313);
assert.equal(inventory.tests_workflow_rename_normalization_package.combined_tracked_deletions, 270);
assert.equal(inventory.tests_workflow_rename_normalization_package.likely_direct_rename_pairs, 193);
assert.equal(inventory.tests_workflow_rename_normalization_package.unmatched_deletions, 77);
assert.equal(inventory.tests_workflow_rename_normalization_package.unmatched_additions, 118);
assert.equal(inventory.tests_workflow_rename_normalization_package.push_safe_now, true);
assert.equal(inventory.tests_workflow_rename_normalization_package.next_step, "closed_on_main_cleanup_anchor_recorded");
assert.equal(inventory.tests_workflow_rename_normalization_package.validated_closeout_head, "aecec58");
assert.equal(inventory.tests_workflow_rename_normalization_package.merged_to_main, true);
assert.ok(Array.isArray(inventory.all_seps_index));
assert.equal(inventory.all_seps_index.length, 41);
const allSepIds = new Set(inventory.all_seps_index.map((item) => item.sep));
for (const sep of [
  "SEP-2663", "SEP-2596", "SEP-2577", "SEP-2575", "SEP-2567", "SEP-2549", "SEP-2484", "SEP-2468", "SEP-2322", "SEP-2260", "SEP-2243", "SEP-2207", "SEP-2164", "SEP-2149", "SEP-2148", "SEP-2133", "SEP-2106", "SEP-2085", "SEP-1865", "SEP-1850", "SEP-1730", "SEP-1699", "SEP-1686", "SEP-1613", "SEP-1577", "SEP-1330", "SEP-1319", "SEP-1303", "SEP-1302", "SEP-1046", "SEP-1036", "SEP-1034", "SEP-1024", "SEP-994", "SEP-991", "SEP-990", "SEP-986", "SEP-985", "SEP-973", "SEP-932", "SEP-414"
]) {
  assert.ok(allSepIds.has(sep), `missing all-SEPs coverage entry: ${sep}`);
}
for (const entry of inventory.all_seps_index) {
  assert.equal(entry.status, "Final", `${entry.sep} must be Final`);
  assert.ok(entry.impact_bucket, `${entry.sep} needs impact_bucket`);
  assert.notEqual(entry.impact_bucket, "unclassified", `${entry.sep} must be classified`);
  assert.ok(entry.inventory_action, `${entry.sep} needs inventory_action`);
}

console.log("smoke_sep_sessionless_inventory ok");
