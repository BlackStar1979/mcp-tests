# DIRECTORY

Status: workflow control-plane directory map
Updated: 2026-07-12

- `deploy_records/`
  Control-plane deployment records and related evidence.
- `file_backups/`
  Workflow-managed backup files used by bounded operational procedures.
- `oauth21_prune_backups/`
  Backups emitted by explicit OAuth21 prune execute runs.
- `oauth21_prune_records/`
  Plan, execute, denied, and rollback records emitted by the OAuth21 prune control-plane script.
- `retired_root_backups/`
  Archived legacy backup location retained for traceability; not active authority.
- `selftest/`
  Self-test support artifacts for control-plane verification.
- `snapshots/`
  Archival point-in-time snapshots; evidence only, not active truth.
- `worktree_commit_triage.js`
  Control-plane helper for bounded worktree commit-scope triage.
