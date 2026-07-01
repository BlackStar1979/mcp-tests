# Run-All Active Audit

## Purpose

First-pass classification of the active default smoke manifest `run_all_smoke_scripts.json`.

This document answers a narrower question than "does the suite pass?".

It records what kinds of checks are currently inside the active `run_all` surface, based on observable file content and references on `2026-07-01`.

## Verified Baseline

- Active default entrypoint: `node _tests/run_all_smokes.js --skip-network`
- Latest confirmed full-manifest verification result: `ok: true`
- Active manifest counts:
  - `7` public scripts
  - `217` total active scripts currently listed in `run_all_smoke_scripts.json`
  - `209` authenticated scripts confirmed green by the latest `--skip-network` full run
  - `_tests/smoke_network.js` remains the one manifest entry intentionally excluded by `--skip-network`

## Classification Method

This audit uses only observable evidence from the current files:

- references to root specs such as `SERVER_*SPEC.json`
- references to workflow records such as `_workflow/state.json`, `_workflow/WORKFLOW_CANON.md`, `_workflow/ACTIVE_WORKFLOW_INDEX.md`, `_workflow/sessionless_inventory.json`, and `_workflow/operator_decisions/*`
- references to workflow scripts or control-plane scripts such as `_workflow/scripts/*` and `test_mcp_*.ps1`
- readiness/planning-oriented filenames such as `*readiness*`, `*plan*`, `*approval*`, `*no_apply*`, `*draft*`, `*prototype*`, `*trial*`, `*evidence*`, `*standardization*`, `*dry_run*`

These classes overlap. They are not a partition.

## Summary

- `7` public-surface scripts
- `42` scripts that directly guard root spec truth
- `22` scripts that directly guard workflow records or compact workflow truth
- `14` scripts that directly guard `_workflow/scripts` or control-plane PowerShell scripts
- `25` scripts with explicit readiness / planning / dry-run naming
- `133` scripts that did not match any of the workflow/spec/readiness heuristics above and look like runtime/protocol behavior checks in this first pass

Operational conclusion:

- The active manifest currently contains `217` scripts.
- The latest confirmed `--skip-network` full run validates `7` public scripts and `209` authenticated scripts.
- Not all active manifest scripts should be interpreted as "current runtime behavior" coverage.
- At least `47` active scripts belong to a mixed review bucket of workflow-record guards, workflow-script guards, or readiness/planning checks.

## Public Surface

These `7` scripts are the explicit public-profile surface used by `run_all_smokes.js`:

- `_tests/descriptor_audit.js`
- `_tests/profile_policy_audit.js`
- `_tests/smoke_profile_schema_validator.js`
- `_tests/smoke_cross_category_spec.js`
- `_tests/smoke_legacy_retired_auth_negative_controls.js`
- `_tests/smoke_fs.js`
- `_tests/smoke_fs_streaming.js`

## Mixed Review Bucket

These `47` active scripts are not obviously dead, but they are not pure runtime/protocol coverage either. They actively validate workflow truth, control-plane scripts, migration records, dry-run packages, or readiness artifacts.

- `_tests/smoke_connector_migration_dry_run_harness.js`
- `_tests/smoke_connector_migration_dry_run_plan.js`
- `_tests/smoke_connector_reconnect_execution_evidence.js`
- `_tests/smoke_connector_refresh_approval_package.js`
- `_tests/smoke_connector_refresh_readiness_spec.js`
- `_tests/smoke_connector_refresh_readiness.js`
- `_tests/smoke_connector_route_coexistence_boundary.js`
- `_tests/smoke_control_plane_audit_env_awareness.js`
- `_tests/smoke_control_plane_deploy_rollback.js`
- `_tests/smoke_crlf_batch_normalization_lf_policy.js`
- `_tests/smoke_crlf_hygiene_plan.js`
- `_tests/smoke_enforcement_apply_readiness_report.js`
- `_tests/smoke_enforcement_wiring_plan_no_apply.js`
- `_tests/smoke_explicit_state_handle_design_rules.js`
- `_tests/smoke_io_safety_active_controls.js`
- `_tests/smoke_io_safety_policy.js`
- `_tests/smoke_isolated_sessionless_activation_regression.js`
- `_tests/smoke_legacy_archive_sessionless_ready_specs.js`
- `_tests/smoke_list_changed_dry_run_pipeline.js`
- `_tests/smoke_list_changed_notification_bus_dry_run.js`
- `_tests/smoke_matrix_check.js`
- `_tests/smoke_mcp_apps_risk_policy.js`
- `_tests/smoke_no_progress_state_active_artifacts.js`
- `_tests/smoke_oauth_production_hardening_plan.js`
- `_tests/smoke_oauth21_sessionless_activation_trial.js`
- `_tests/smoke_operator_approval_boundary_guard.js`
- `_tests/smoke_plugin_visibility_plan_output_schema.js`
- `_tests/smoke_policy_coverage_matrix.js`
- `_tests/smoke_process_runner_observability.js`
- `_tests/smoke_registry_diff_dry_run.js`
- `_tests/smoke_root_server_specs_consistency.js`
- `_tests/smoke_runtime_enforcement_apply_package_draft.js`
- `_tests/smoke_runtime_enforcement_no_apply_package.js`
- `_tests/smoke_runtime_identity_workflow_boundary.js`
- `_tests/smoke_runtime_topology_authority.js`
- `_tests/smoke_sampling_user_approval_policy.js`
- `_tests/smoke_sep_sessionless_inventory.js`
- `_tests/smoke_sessionless_live_authenticated_probe.js`
- `_tests/smoke_sessionless_manual_probe_contract.js`
- `_tests/smoke_sessionless_runtime_prototype.js`
- `_tests/smoke_sessionless_target_selection_readiness.js`
- `_tests/smoke_state_and_snapshot_hygiene.js`
- `_tests/smoke_streamable_http_workflow_plan.js`
- `_tests/smoke_workbench_debt_cleanup.js`
- `_tests/smoke_workbench_sessionless_standardization.js`
- `_tests/smoke_workflow_truth_repair.js`
- `_tests/smoke_workstream_boundary_control_review.js`

## What This Means

Confirmed from files:

- the active manifest is current in the mechanical sense: the listed scripts run and pass
- the active manifest is not yet a compact "current runtime only" suite
- workflow truth and historical/process guards are still embedded in the default active path

Not yet confirmed:

- whether each of the remaining active non-mixed-review scripts are semantically up to date beyond still passing
- whether some spec guards should move to a separate `run_all_specs` or `run_all_workflow` entrypoint

## Recommended Next Step

Before removing anything from `run_all`, do one more explicit pass over the `47` mixed-review scripts and classify each into one of:

- keep in default `run_all`
- move to a dedicated workflow/control-plane manifest
- move to a dedicated readiness/dry-run manifest
- archive or rewrite

Do not remove them only because their names look historical. Several of them currently protect compact workflow truth and current sessionless state.

Second-pass classification now lives in `RUN_ALL_MIXED_REVIEW_CLASSIFICATION.md`.

Helper manifests prepared from that classification:

- `run_all_workflow_control_plane_smoke_scripts.json`
- `run_all_readiness_smoke_scripts.json`
