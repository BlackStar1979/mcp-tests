# _workflow/scripts

## Purpose

Workflow-only utilities, validators, snapshot helpers, and control-plane scripts used to maintain canonical repo state.

These scripts are not the default server runtime surface.
Historical names inside this directory describe evidence origin only; they do not by themselves mean the script is part of the current active plan.

## Groups

- Spec loading and validation: `load_server_specs.js`, `validate_server_spec_fixtures.js`, `validate_server_spec_negative_controls.js`, `evaluate_server_spec_decisions.js`, `evaluate_server_spec_decision_negative_controls.js`, `validate_decision_runtime_interface_contract.js`, `validate_decision_runtime_interface_contract_negative_controls.js`
- Workflow patching and snapshotting: `patch_section_by_markers.js`, `workflow_snapshot.js`
- Policy and matrix helpers: `matrix_check.js`, `index_authority_report.js`, `io_approval_policy.js`, `io_data_policy.js`, `io_mcp_apps_risk_policy.js`, `io_prompt_firewall.js`, `io_safety_policy.js`, `process_runner_observability.js`
- Historical workflow spot-check wrappers: `debt_reduction_check.js`, `project_debt_review_check.js`, `runtime_apply_package_preparation_check.js`, `runtime_execution_package_no_apply_check.js`, `runtime_execution_package_operator_approval_check.js`, `runtime_implementation_plan_no_code_check.js`, `runtime_implementation_plan_operator_approval_check.js`
- Sessionless and connector helpers: `connector_migration_dry_run_harness.js`, `sessionless_live_authenticated_probe.js`, `sessionless_manual_probe_stub.js`
- Runtime log and reference maintenance: `compact_runtime_logs.js`, `build_openai_responses_ref_index.js`
- Debug-only utility: `debug_fixture_creator.js`
- Control-plane runtime scripts: `test_mcp_backup.ps1`, `test_mcp_deploy.ps1`, `test_mcp_restart.ps1`, `test_mcp_rollback.ps1`
- Control-plane OAuth state maintenance: `test_mcp_oauth21_prune.js`

## Current interpretation

- `workflow_snapshot.js` and `test_mcp_backup.ps1` maintain archival control-plane evidence under `_workflow/control_plane/snapshots/`; that archive is not the active truth layer.
- `*_check.js`, `validate_*.js`, and dry-run harnesses are workflow helpers. Their existence does not mean the underlying migration step is still current.
- `sessionless_*` helpers are retained as historical evidence and bounded probes. Since active runtime retirement of hidden `/mcp/sessionless`, they must not be misread as the target architecture.
- `public_sandbox_sync.js` is retired. Its unguarded copy operation duplicated active runtime source into a non-authoritative ignored tree, while the corresponding historical smoke depends on a missing manifest. Git history preserves the evidence; the active workflow must not recreate this mutator.
- `test_mcp_oauth21_prune.js` is a control-plane helper for OAuth21 state hygiene only. It supports `Status`, `Plan`, `Execute`, and `Rollback`, writes records under `_workflow/control_plane/oauth21_prune_records/`, writes backups under `_workflow/control_plane/oauth21_prune_backups/`, and does not expose a connector-visible runtime tool.
- Current repo-hygiene note: `_tests` and `_workflow` are still inside one rename-normalization migration wave. Use `_tests/RENAME_NORMALIZATION_MIGRATION_AUDIT.md` plus the active workflow queue before treating old/new script paths as independently stable.

## Notes

- `debug_fixture_creator.js` is a troubleshooting helper and may invoke archived spot-checks on purpose.
- `test_mcp_*.ps1` scripts are operator-controlled workflow artifacts, not connector-visible runtime tools.
- `test_mcp_oauth21_prune.js` requires explicit file-path arguments and approval material for `Execute`; it must not be wired into runtime startup, runtime status auto-apply, or connector-authenticated request handling.
- If a script here becomes part of active required validation, reference it from a current smoke by purpose, not by historical stage numbering.
- Historical names retained in wrapper scripts describe their evidence origin only. New active scripts should prefer purpose-based naming.
