# Run-All Mixed Review Classification

## Purpose

Primary-bucket classification of the `47` mixed-review scripts identified in `RUN_ALL_ACTIVE_AUDIT.md`.

This is the second pass after the coarse audit. It does not remove any script from the default active manifest yet.

## Current Decision

Keep the default active manifest unchanged for now.

Add two helper manifests so the workflow/control-plane and readiness/dry-run slices can be executed explicitly without duplicating the harness:

- `run_all_workflow_control_plane_smoke_scripts.json`
- `run_all_readiness_smoke_scripts.json`

Use:

- `node _tests/run_all_smokes.js --manifest _tests/run_all_workflow_control_plane_smoke_scripts.json --skip-network`
- `node _tests/run_all_smokes.js --manifest _tests/run_all_readiness_smoke_scripts.json --skip-network`

## Workflow / Control Plane

These scripts primarily protect current workflow truth, control-plane behavior, compact state truth, or active sessionless/operator records.

- `_tests/smoke_connector_reconnect_execution_evidence.js`
- `_tests/smoke_connector_route_coexistence_boundary.js`
- `_tests/smoke_control_plane_audit_env_awareness.js`
- `_tests/smoke_control_plane_deploy_rollback.js`
- `_tests/smoke_crlf_batch_normalization_lf_policy.js`
- `_tests/smoke_explicit_state_handle_design_rules.js`
- `_tests/smoke_io_safety_active_controls.js`
- `_tests/smoke_io_safety_policy.js`
- `_tests/smoke_isolated_sessionless_activation_regression.js`
- `_tests/smoke_legacy_archive_sessionless_ready_specs.js`
- `_tests/smoke_matrix_check.js`
- `_tests/smoke_mcp_apps_risk_policy.js`
- `_tests/smoke_no_progress_state_active_artifacts.js`
- `_tests/smoke_policy_coverage_matrix.js`
- `_tests/smoke_process_runner_observability.js`
- `_tests/smoke_root_server_specs_consistency.js`
- `_tests/smoke_runtime_identity_workflow_boundary.js`
- `_tests/smoke_runtime_topology_authority.js`
- `_tests/smoke_sep_sessionless_inventory.js`
- `_tests/smoke_sessionless_live_authenticated_probe.js`
- `_tests/smoke_sessionless_manual_probe_contract.js`
- `_tests/smoke_state_and_snapshot_hygiene.js`
- `_tests/smoke_workbench_debt_cleanup.js`
- `_tests/smoke_workflow_truth_repair.js`
- `_tests/smoke_workstream_boundary_control_review.js`

## Readiness / Dry Run

These scripts primarily protect non-apply packages, approval boundaries, planning artifacts, standardization decisions, or readiness-only contracts.

Current helper manifest membership:

- `_tests/smoke_connector_migration_dry_run_harness.js`
- `_tests/smoke_connector_migration_dry_run_plan.js`
- `_tests/smoke_connector_refresh_approval_package.js`
- `_tests/smoke_connector_refresh_readiness_spec.js`
- `_tests/smoke_connector_refresh_readiness.js`
- `_tests/smoke_crlf_hygiene_plan.js`
- `_tests/smoke_enforcement_apply_readiness_report.js`
- `_tests/smoke_enforcement_wiring_plan_no_apply.js`
- `_tests/smoke_debt_reduction_guard.js`
- `_tests/smoke_project_debt_review_guard.js`
- `_tests/smoke_list_changed_dry_run_pipeline.js`
- `_tests/smoke_list_changed_notification_bus_dry_run.js`
- `_tests/smoke_oauth_production_hardening_plan.js`
- `_tests/smoke_oauth21_sessionless_activation_trial.js`
- `_tests/smoke_operator_approval_boundary_guard.js`
- `_tests/smoke_plugin_visibility_plan_output_schema.js`
- `_tests/smoke_registry_diff_dry_run.js`
- `_tests/smoke_runtime_apply_package_preparation_no_apply.js`
- `_tests/smoke_runtime_enforcement_apply_package_draft.js`
- `_tests/smoke_runtime_enforcement_no_apply_package.js`
- `_tests/smoke_runtime_execution_package_no_apply.js`
- `_tests/smoke_runtime_execution_package_operator_approval.js`
- `_tests/smoke_runtime_implementation_plan_no_code.js`
- `_tests/smoke_runtime_implementation_plan_operator_approval.js`
- `_tests/smoke_runtime_scope_approval_package.js`
- `_tests/smoke_runtime_scope_operator_decision.js`
- `_tests/smoke_sampling_user_approval_policy.js`
- `_tests/smoke_keep_mcp_post_accept_json_only_cleanup.js`
- `_tests/smoke_keep_mcp_get_sse_teardown.js`
- `_tests/smoke_keep_mcp_request_contract_bridge.js`
- `_tests/smoke_keep_mcp_initialize_retirement_boundary.js`
- `_tests/smoke_keep_mcp_sessionless_replacement_coverage_scoping.js`
- `_tests/smoke_keep_mcp_subscriptions_listen_pull_only_contract.js`
- `_tests/smoke_single_route_no_sse_target_plan.js`
- `_tests/smoke_single_route_selection_keep_mcp.js`
- `_tests/smoke_single_route_no_sse_migration_debt_inventory.js`
- `_tests/smoke_keep_mcp_no_sse_replacement_package.js`
- `_tests/smoke_sep2549_list_read_cache_inventory.js`
- `_tests/smoke_sessionless_runtime_prototype.js`
- `_tests/smoke_sessionless_prototype_route_retirement_scoping.js`
- `_tests/smoke_subscriptions_listen_compatibility_matrix.js`
- `_tests/smoke_subscriptions_listen_no_sse_project_contract.js`
- `_tests/smoke_sessionless_target_selection_readiness.js`
- `_tests/smoke_streamable_http_workflow_plan.js`
- `_tests/smoke_workbench_sessionless_standardization.js`

`_tests/smoke_subscriptions_listen_isolated_validation.js` remains outside the helper manifest on purpose. It validates the former isolated SSE-based hidden-route implementation and is no longer compatible with the current retired-route baseline for bundled readiness runs.

## Not Removed Yet

These helper manifests are preparatory. The files still remain in the default `run_all_smoke_scripts.json` manifest until a later small step explicitly removes them and revalidates the resulting baseline.
