# _tests

## Purpose

Executable smoke tests, stress checks, topology guards, archive fixtures, and helper harnesses for `mcp-tests`.

## Current Status

Audit snapshot from `2026-07-02`:

- `293` JavaScript files total in `_tests`
- `218` active scripts currently listed in `run_all_smoke_scripts.json`
- `17` archived legacy retired-auth scripts in `archive/legacy_retired_auth/`
- `17` archived stale non-`run_all` scripts in `archive/non_run_all_stale/`
- `7` `stress_*.js` scripts for explicit manual stress runs against a running MCP endpoint
- `40` top-level `_tests/*.js` files currently outside default `run_all`; these are mixed targeted guards, helpers, wrappers, stress harnesses, and review debt

Latest full active validation:

- `node _tests/run_all_smokes.js --skip-network`
- last confirmed result from `2026-07-01`: `ok=true`
- last confirmed section counts from that full run: `7` public scripts and `210` authenticated scripts
- current manifest file contains `218` entries, including `_tests/smoke_network.js`; `--skip-network` therefore validates `217` sectioned scripts, not all `218` manifest entries

## Orientation

- Active smoke entrypoint: `run_all_smokes.js`
- Active manifest: `run_all_smoke_scripts.json`
- Active manifest audit: `RUN_ALL_ACTIVE_AUDIT.md`
- Mixed-review split: `RUN_ALL_MIXED_REVIEW_CLASSIFICATION.md`
- Rename-normalization migration audit: `RENAME_NORMALIZATION_MIGRATION_AUDIT.md`
- Helper manifests: `run_all_workflow_control_plane_smoke_scripts.json`, `run_all_readiness_smoke_scripts.json`, `run_all_targeted_debt_smoke_scripts.json`
- Current workflow/control-plane helper manifest size: `25` scripts
- Current readiness helper manifest size: `45` scripts
- Current targeted/debt helper manifest size: `6` scripts
- Legacy retired auth archive: `archive/legacy_retired_auth/`
- Archived stale non-`run_all` scripts: `archive/non_run_all_stale/`
- Historical names with `stage` / `step` prefixes are not authoritative for current navigation.
- A large rename-normalization migration is still open across `_tests` and `_workflow`; treat `RENAME_NORMALIZATION_MIGRATION_AUDIT.md` as the current package map instead of inferring from raw `git status`.
- Non-`run_all` audit inventory: `NON_RUN_ALL_AUDIT.md`

## Active Groups

- Public profile surface: descriptor audit, profile audit, public FS surface, and profile schema checks
- Core authenticated surface: policy, routing, schema, MCP dispatch, repo/runtime topology, and enforcement guards
- OAuth and OAuth21: AS metadata, JWKS/introspection, DCR, PKCE, rotation, state, and route contract checks
- Sessionless transition track: SEP inventory, hidden route, isolated/live activation, and migration-debt mapping toward a final single-route no-SSE target
- Tools-list and hotplug track: tools cache, list-changed, state store preview/receipt/pipeline, and event-driven lifecycle checks
- Workflow and state hygiene: closeout, navigation, topology cleanup, truth repair, LF policy, and snapshot/state consistency

## Naming Notes

- `smoke_request_cancellation_context.js`: active cancellation-context plumbing guard
- `smoke_client_disconnect_write_guard.js`: active client-disconnect write-boundary guard
- `smoke_cooperative_tool_cancellation.js`: active cooperative tool-cancellation guard
- Historical shorthand `c1` / `c2` / `c3` referred to these three cancellation-related guards. Current active names are the descriptive filenames above; do not recreate the shorthand in new files.
- `stress_*.js`: not part of default `run_all`; each script posts directly to `process.env.MCP_TEST_SMOKE_URL || http://127.0.0.1:3009/mcp` and requires a running MCP server
- `archive/legacy_retired_auth/*.js`: historical files retained outside the active surface
- `archive/non_run_all_stale/*.js`: removed from the current top-level review surface because they are stale or broken
- Historical names preserved inside archived files are evidence labels only. Do not copy them into new active filenames.

## Non-Run-All Files

These are not all equivalent and should not be assumed current just because they exist.

- Harness helpers: `run_all_smokes.js`, `smoke_auth_fetch_patch.js`
- Explicit stress scripts: `stress_*.js`
  These are manual external-client stress harnesses, not self-contained smoke tests. Direct execution without a running target server produces transport failure such as `fetch failed`.
- Archived legacy scripts: `archive/legacy_retired_auth/*.js`
- Archived stale scripts: `archive/non_run_all_stale/*.js`
- Targeted/manual guards outside default `run_all`: for example `smoke_harness_no_pollution_guard.js`, `smoke_canary_naming_guard.js`, `smoke_list_changed_readiness_contract.js`
- Previously identified stale or broken guards were moved out of the top-level `_tests` surface into `archive/non_run_all_stale/`

Current top-level non-`run_all` inventory:

- Historical audit from `2026-06-29` classified `32` files.
- Current mechanical count is `40`, so the older classification is still useful but not complete for every newly renamed or added file.

- Helpers: `run_all_smokes.js`, `smoke_auth_fetch_patch.js`
- Current targeted guards include: `smoke_audit_redaction_integration_plan.js`, `smoke_auth_bootstrap_config_resolver.js`, `smoke_auth_port_policy.js`, `smoke_canary_naming_guard.js`, `smoke_keep_mcp_initialize_retirement_boundary.js`, `smoke_keep_mcp_sessionless_replacement_coverage_scoping.js`, `smoke_keep_mcp_subscriptions_listen_pull_only_contract.js`, `smoke_list_changed_readiness_contract.js`, `smoke_policy_spec.js`, `smoke_preflight_control_plane_guard.js`, `smoke_sep2549_list_read_cache_inventory.js`, `smoke_sessionless_prototype_route_retirement_scoping.js`, `smoke_state_store_apply_readiness_gate.js`, `smoke_subscriptions_listen_compatibility_matrix.js`, `smoke_subscriptions_listen_isolated_validation.js`, `smoke_subscriptions_listen_no_sse_project_contract.js`
- Meta guard: `smoke_harness_no_pollution_guard.js`
- Historical workflow wrappers: `smoke_decision_runtime_integration_plan.js`, `smoke_decision_runtime_interface_contract_readiness_gate.js`, `smoke_decision_runtime_operator_gate.js`, `smoke_logs_migration.js`, `smoke_debt_reduction_guard.js`, `smoke_project_debt_review_guard.js`, `smoke_repo_layout_contract.js`, `smoke_runtime_apply_package_preparation_no_apply.js`, `smoke_runtime_execution_package_no_apply.js`, `smoke_runtime_execution_package_operator_approval.js`, `smoke_runtime_implementation_plan_no_code.js`, `smoke_runtime_implementation_plan_operator_approval.js`, `smoke_runtime_scope_approval_package.js`, `smoke_runtime_scope_operator_decision.js`
- The old transitional SSE/list-changed debt guards were retired after their unreachable helper files were removed from the active repo. `run_all_targeted_debt_smoke_scripts.json` now contains only the remaining workflow/control-plane review subset.

Stress inventory:

- `stress_devtools.js`: manual HTTP stress run for devtools surface
- `stress_plugin_catalog.js`: manual HTTP stress run for plugin catalog read path
- `stress_plugin_execution.js`: manual HTTP stress run for plugin execution path
- `stress_plugin_registry.js`: manual HTTP stress run for plugin registry surface
- `stress_plugin_visibility.js`: manual HTTP stress run for plugin visibility surface
- `stress_runtime.js`: manual HTTP stress run for runtime/control-plane path
- `stress_session_toolsets.js`: manual HTTP stress run for session toolset surface

## Maintenance Rules

Use the current filename and the active manifest as the source of truth. Do not rebuild directory orientation from historical stage numbering.

Do not assume every `smoke_*.js` file is active. Check `run_all_smoke_scripts.json` first.

If a file is outside `run_all`, it requires explicit classification before being treated as current coverage.
