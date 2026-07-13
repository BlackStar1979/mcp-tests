# DIRECTORY

Status: workflow scripts directory map
Updated: 2026-07-12

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
- `test_mcp_backup.ps1`, `test_mcp_deploy.ps1`, `test_mcp_restart.ps1`, `test_mcp_rollback.ps1`
  Operator-run control-plane scripts for backup, deploy, restart, and rollback procedures.
- `test_mcp_oauth21_prune.js`
  Operator-run OAuth21 prune control-plane helper with `Status`, `Plan`, `Execute`, and `Rollback` modes.
- `debug_fixture_creator.js`
  Debug-only troubleshooting utility.
