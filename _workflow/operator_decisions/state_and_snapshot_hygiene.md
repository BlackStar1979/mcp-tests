# S16 State And Snapshot Hygiene Repair

Status: GREEN / REPAIRED / NO RUNTIME CHANGE
Date: 2026-06-29

## Purpose

Repair two workflow-truth defects:

1. reduce `_workflow/state.json` back to a compact orientation map instead of a stage/checklist summary;
2. stop and clean recursive snapshot embedding under `_workflow/control_plane/snapshots`.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- public_3009_start_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit

## State-map repair

Removed non-orientation progress/checklist sections from `_workflow/state.json`:

- `next_step_recommendation_policy`
- `hotplug_lifecycle`
- `sessionless_target_selection`
- `legacy_retired_auth_cleanup`
- `root_spec_sessionless_ready_review`
- `crlf_batch_normalization`

Those truths remain in their authoritative sources:

- sessionless target status: `_workflow/sessionless_inventory.json`
- hotplug lifecycle status: `SERVER_PLUGIN_VISIBILITY_POLICY_SPEC.json#hotplug_lifecycle_readiness`
- legacy retired auth archive: `_tests/legacy_retired_auth_smoke_manifest.json`
- root spec sessionless-ready review: root `SERVER_*_SPEC.json`
- CRLF normalization evidence: `_workflow/operator_decisions/crlf_batch_normalization_lf_policy.md`
- recommendation duty / assistant restart rule: `_workflow/README.md`, `_workflow/WORKFLOW_CANON.md`, and `_workflow/operator_decisions/stage14_9_workflow_truth_repair.md`

`_workflow/state.json` remains compact and must stay below the current guard limit.

## Snapshot repair

Confirmed defect: backup snapshots created from broad `_workflow` copies embedded `_workflow/control_plane/snapshots` inside later snapshots, causing recursive growth.

Repair actions:

- `test_mcp_backup.ps1` now excludes `_workflow/control_plane/snapshots` when `_workflow` is included.
- `workflow_snapshot.js` now rejects direct snapshot targets under `_workflow/control_plane/snapshots`.
- Existing nested snapshot subtrees under top-level snapshot directories were removed.

## Confirmed boundaries

- No top-level snapshot directory was deleted wholesale.
- Archive-boundary README files now exist at `_workflow/historical/`, `_tests/archive/`, and `_tests/archive/legacy_retired_auth/` so archived evidence is less likely to be mistaken for active workflow truth.
- `_workflow/control_plane/retired_root_backups/README.md` now marks legacy moved root backups as archival quarantine rather than an active interpretation layer.
- No runtime code, connector surface, auth mode, or tool catalog was changed.
- No OAuth21 3008 restart was required or performed.
- No public 3009 start was required or performed.

## Next recommendation

Keep `_workflow/state.json` as an orientation map only. Any future stage/checklist truth belongs in inventory, root specs, operator decisions, or the canon, not in `state.json`.

Keep archive-boundary README files in sync with the active hygiene guards so historical `_workflow/**` and `_tests/**` contents do not become accidental navigation authority.
