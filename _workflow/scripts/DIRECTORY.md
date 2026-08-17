# DIRECTORY

Status: workflow scripts directory map
Updated: 2026-07-17

- `README.md`
  Scope, boundaries, and interpretation rules for workflow helper and control-plane scripts.
- `build_*.js`, `load_server_specs.js`, `validate_*.js`, `evaluate_*.js`
  Spec-loading, validation, and workflow-guard helpers used by smokes and bounded checks.
- `matrix_check.js`, `index_authority_report.js`, `io_*.js`, `process_runner_observability.js`
  Policy, matrix, and repo-process support scripts.
- `workflow_snapshot.js`, `patch_section_by_markers.js`
  Workflow snapshotting and bounded text patch helpers.
- `sessionless_*`, `connector_migration_dry_run_harness.js`
  Historical or bounded probe helpers retained for evidence; not active target architecture by themselves.
- `client_entry_path_report.js`
  Audit-reading helper that summarizes current client entry-path evidence on the live authenticated route, including `client_name`, `evidence_scope`, and optional `max_age_days` filters for separating operational/synthetic evidence and trimming stale retained client families.
- `cli_args.js`
  Workflow-facing facade for the shared fail-closed CLI parser in `src/util/cli_args.js`; accepts both `--name=value` and `--name value` while rejecting missing, duplicate, unknown, or positional arguments.
- `client_entry_blocker_matrix.js`
  Audit-reading helper that compares initialize-retirement blocker sets across multiple retained-evidence freshness windows so current operational blockers can be separated from long-tail history.
- `wait_for_client_entry_path.js`
  Polling helper that waits for the next fresh entry event for a named client family and returns the corresponding entry-path report once new evidence appears, with the same optional retained-evidence freshness filter.
- `test_mcp_backup.ps1`, `test_mcp_deploy.ps1`, `test_mcp_restart.ps1`, `test_mcp_rollback.ps1`
  Operator-run control-plane scripts for backup, deploy, restart, and rollback procedures.
- `test_mcp_oauth21_prune.js`
  Operator-run OAuth21 prune control-plane helper with `Status`, `Plan`, `Execute`, and `Rollback` modes.
- `debug_fixture_creator.js`
  Debug-only troubleshooting utility.
