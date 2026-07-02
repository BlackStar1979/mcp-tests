# Non-Run-All Audit

## Purpose

Classification of `_tests/*.js` files that are not part of the active default smoke manifest `run_all_smoke_scripts.json`.

Audit date: `2026-07-01`

## Summary

- `32` top-level `_tests/*.js` files were outside default `run_all` at audit time
- these files are not all stale, but they are not all equally current either
- default active validation remains `node _tests/run_all_smokes.js --skip-network`
- `17` stale or broken top-level files from this audit were moved to `archive/non_run_all_stale/`
- current mechanical count may be higher after later renames/additions and must be re-audited instead of assumed from this snapshot

Post-audit drift now visible from the current tree:

- current mechanical non-`run_all` count is `40`
- the former transitional SSE/list-changed debt guards were later removed entirely after their unreachable helper files were retired from the active repo
- all seven `stress_*.js` files were rechecked directly in source on `2026-06-30`
- each stress file posts directly to `process.env.MCP_TEST_SMOKE_URL || "http://127.0.0.1:3009/mcp"` and therefore requires a separately running MCP server
- direct standalone execution without a running target server fails at transport level and must not be misread as proof of stale assertions

Helper execution slices now available:

- `node _tests/run_all_smokes.js --manifest _tests/run_all_workflow_control_plane_smoke_scripts.json --skip-network`
- `node _tests/run_all_smokes.js --manifest _tests/run_all_readiness_smoke_scripts.json --skip-network`
- `node _tests/run_all_smokes.js --manifest _tests/run_all_targeted_debt_smoke_scripts.json --skip-network`

## Status Classes

- `current_helper`: active support code used by active smoke execution
- `current_targeted_guard`: current guard or targeted contract check kept outside default `run_all`
- `meta_guard`: recursive or full-run wrapper guard kept outside default `run_all`
- `manual_external_stress`: explicit stress client that requires a separately running MCP endpoint
- `historical_workflow_wrapper`: wrapper around historical `_workflow/scripts/*` or `_workflow/patch_manifests/*` checkpoints
- `archived_from_top_level`: file was identified as stale or broken and moved out of the current top-level review surface

## Inventory

### `current_helper`

- `run_all_smokes.js`
  Reason: active smoke entrypoint; orchestrates the validated public/authenticated run.
  Recommendation: keep active.
- `smoke_auth_fetch_patch.js`
  Reason: helper patch used by `run_all_smokes.js` to inject authenticated headers.
  Recommendation: keep active as helper, not as standalone smoke.

### `current_targeted_guard`

- `smoke_audit_redaction_integration_plan.js`
  Reason: current targeted guard for redaction planning module.
  Recommendation: keep outside default `run_all` unless this planning-only surface becomes part of required baseline.
- `smoke_auth_bootstrap_config_resolver.js`
  Reason: current focused unit-style guard for bootstrap auth config resolution.
  Recommendation: keep; candidate for promotion only if bootstrap regressions become common.
- `smoke_auth_port_policy.js`
  Reason: current focused guard for auth port policy and retired-mode boundaries.
  Recommendation: keep.
- `smoke_canary_naming_guard.js`
  Reason: current naming guard for TEST MCP health canary identifiers.
  Recommendation: keep.
- `smoke_list_changed_readiness_contract.js`
  Reason: current readiness-only contract guard for `list_changed` staying disabled.
  Recommendation: keep outside default `run_all` unless hotplug activation becomes active scope.
- `smoke_policy_spec.js`
  Reason: current root structured-spec cross-check for `SERVER_AUTHZ_DECISION_SPEC.json`.
  Recommendation: keep; possible future promotion to `run_all`.
- `smoke_preflight_control_plane_guard.js`
  Reason: current control-plane directory and state-map guard.
  Recommendation: keep.
- `smoke_state_store_apply_readiness_gate.js`
  Reason: current readiness-only gate for plugin visibility state-store apply path.
  Recommendation: keep outside default `run_all` while apply remains disabled.
- `smoke_keep_mcp_initialize_retirement_boundary.js`
  Reason: current targeted guard for the bounded legacy `initialize` retirement boundary on surviving `/mcp`.
  Recommendation: keep outside default `run_all`; it protects migration-boundary truth rather than core runtime baseline behavior.
- `smoke_keep_mcp_sessionless_replacement_coverage_scoping.js`
  Reason: current targeted guard for replacement-coverage scoping before any historical hidden-route removal is interpreted as complete.
  Recommendation: keep outside default `run_all`; it is active workflow/coverage truth, not baseline protocol behavior.
- `smoke_keep_mcp_subscriptions_listen_pull_only_contract.js`
  Reason: current targeted guard for the final pull-only freshness contract on surviving `/mcp`.
  Recommendation: keep outside default `run_all`; it protects target-contract truth and no-SSE design boundaries.
- `smoke_sep2549_list_read_cache_inventory.js`
  Reason: current targeted guard for explicit SEP-2549-style cache directive inventory and its bounded scope.
  Recommendation: keep outside default `run_all`; promote only if this inventory becomes part of required baseline validation.
- `smoke_sessionless_prototype_route_retirement_scoping.js`
  Reason: current targeted guard for the scoped retirement package around the historical hidden `/mcp/sessionless` route.
  Recommendation: keep outside default `run_all`; it remains workflow-target truth, not default protocol coverage.
- `smoke_subscriptions_listen_compatibility_matrix.js`
  Reason: current targeted guard for the historical compatibility matrix between stable GET SSE debt, request-scoped listen semantics, and list-changed dry-run behavior.
  Recommendation: keep outside default `run_all`; it is still useful debt-mapping evidence but not part of the active baseline suite.
- `smoke_subscriptions_listen_isolated_validation.js`
  Reason: historical targeted guard for the isolated higher-port SSE-based hidden-route implementation of `subscriptions/listen`, now rewritten to validate historical evidence plus current retired-route truth rather than rerunning the obsolete stream probe.
  Recommendation: keep outside default `run_all` and outside helper readiness bundles; it preserves transition evidence without pretending the retired hidden-route SSE behavior is still current runtime truth.
- `smoke_subscriptions_listen_no_sse_project_contract.js`
  Reason: current targeted guard for the stricter project-level no-SSE interpretation of the final TEST MCP destination.
  Recommendation: keep outside default `run_all`; it protects target-policy truth rather than default runtime behavior.
These current targeted/debt guards are additionally grouped in `run_all_targeted_debt_smoke_scripts.json` so they can be exercised together without promoting them into the default active baseline. The older SSE/list-changed targeted-debt subset has already been removed along with the unreachable helper files it was preserving.

### `meta_guard`

- `smoke_harness_no_pollution_guard.js`
  Reason: spawns an inner `run_all_smokes.js` and verifies no pollution of production audit log.
  Recommendation: keep outside default `run_all` to avoid recursive default execution cost.

### `manual_external_stress`

- `stress_devtools.js`
- `stress_plugin_catalog.js`
- `stress_plugin_execution.js`
- `stress_plugin_registry.js`
- `stress_plugin_visibility.js`
- `stress_runtime.js`
- `stress_session_toolsets.js`
  Reason: each script is an explicit HTTP client harness that targets `MCP_TEST_SMOKE_URL` (default `http://127.0.0.1:3009/mcp`) and measures latency/behavior under repeated concurrent tool calls.
  Recommendation: keep outside default `run_all`; document and invoke only when a matching MCP server is already running and the operator intentionally wants load or concurrency coverage.

### `historical_workflow_wrapper`

- `smoke_decision_runtime_integration_plan.js`
- `smoke_decision_runtime_interface_contract_readiness_gate.js`
- `smoke_decision_runtime_operator_gate.js`
- `smoke_logs_migration.js`
- `smoke_debt_reduction_guard.js`
- `smoke_project_debt_review_guard.js`
- `smoke_repo_layout_contract.js`
- `smoke_runtime_apply_package_preparation_no_apply.js`
- `smoke_runtime_execution_package_no_apply.js`
- `smoke_runtime_execution_package_operator_approval.js`
- `smoke_runtime_implementation_plan_no_code.js`
- `smoke_runtime_implementation_plan_operator_approval.js`
- `smoke_runtime_scope_approval_package.js`
- `smoke_runtime_scope_operator_decision.js`
  Reason: these files wrap historical step/patch-manifest checkpoints or point to historical workflow validation scripts.
  Recommendation: keep only as explicit spot-checks while those artifacts remain authoritative; do not treat as baseline active coverage.

### `archived_from_top_level`

- `smoke_auth_precutover_operator_checklist.js`
  Reason: hard-pins old runtime assumptions such as `46` tools, `access` auth mode, and retired transition tools.
  Recommendation: keep archived until intentionally rewritten against current OAuth21 runtime truth.
- `smoke_auth_transition_readiness.js`
  Reason: local transition helper smoke for legacy bearer cutover readiness; no longer part of the active runtime target and no longer referenced by active smoke.
  Recommendation: keep archived until a current auth-transition track explicitly needs it again.
- `smoke_readiness_guard_parity.js`
  Reason: parity smoke for retired bearer cutover helpers; no longer part of active runtime validation and no longer referenced by active smoke.
  Recommendation: keep archived until intentionally rewritten or deleted with the old helper modules.
- `smoke_cache_ttl_guard.js`
  Reason: file contained only `console.log(1)`.
  Recommendation: keep archived until a real cache TTL guard is intentionally rewritten.
- `smoke_closeout_control_review.js`
  Reason: historical wrapper pointing to missing Step 38H/38I patch manifests and longterm docs.
  Recommendation: keep archived unless those checkpoints are rebuilt as current evidence.
- `smoke_course_correction_ledger.js`
  Reason: hard-pins old `CURRENT_WORKING_COURSE` and old `stage8_53a/stage8_53b` sequence.
  Recommendation: keep archived until rewritten around current workflow truth.
- `smoke_live_check.js`
  Reason: historical wrapper pointing to a missing Step 38BR live-check patch manifest.
  Recommendation: keep archived unless rewritten against current runtime evidence.
- `smoke_mechanism_parity_matrix.js`
  Reason: still expects `_workflow/WORKING_COURSE.md`, `_workflow/NEXT_CHAT_HANDOFF.md`, `_workflow/INDEX.md`, and `_workflow/SERVER_SPEC.md` legacy documentation flow.
  Recommendation: keep archived until rewritten.
- `smoke_public_behavior.js`
  Reason: historical wrapper pointing to a missing Step 38F public-behavior patch manifest.
  Recommendation: keep archived unless rewritten against current public-runtime evidence.
- `smoke_public_sandbox_gap.js`
  Reason: historical wrapper pointing to a missing Step 38D sandbox-gap patch manifest.
  Recommendation: keep archived unless rewritten against current public-sandbox evidence.
- `smoke_public_sandbox_sync.js`
  Reason: historical wrapper pointing to a missing Step 38E sandbox-sync patch manifest.
  Recommendation: keep archived unless rewritten against current public-sandbox evidence.
- `smoke_raw_rpc_harness_manifest.js`
  Reason: historical wrapper pointing to a missing Step 38G raw-RPC harness manifest.
  Recommendation: keep archived unless the harness is rebuilt as a current artifact.
- `smoke_refresh.js`
  Reason: historical wrapper pointing to a missing Step 38C refresh-execution manifest.
  Recommendation: keep archived unless rewritten around current connector/runtime refresh evidence.
- `smoke_repository_topology_relocation.js`
  Reason: still expects `_workflow/INDEX.md` and historical topology/doc layout assumptions.
  Recommendation: keep archived until rewritten.
- `smoke_server_spec_current_truth.js`
  Reason: still reads `_workflow/SERVER_SPEC.md` and asserts old tool-count truth (`46`, `32`).
  Recommendation: keep archived until rewritten to current root-spec truth.
- `smoke_topology_cleanup_guard.js`
  Reason: currently fails because it expects `_workflow/INDEX.md` and older README topology rules.
  Recommendation: keep archived until rewritten.
- `smoke_truth_parity_internal.js`
  Reason: hard-pins old `current_working_course` / `stage8_53a` truth flow.
  Recommendation: keep archived until rewritten.

## Operational Conclusion

- The default active smoke surface is current and green.
- The non-`run_all` surface is mixed and should not be treated as one coherent active suite.
- Historical stage/step identifiers that remain inside archived or wrapper filenames are evidence labels only, not active planning vocabulary.
- Before promoting any non-`run_all` file into baseline validation, it should first be classified into one of:
  - keep as helper
  - keep as targeted spot-check
  - archive as historical
  - rewrite as current
  - delete as placeholder/stale
