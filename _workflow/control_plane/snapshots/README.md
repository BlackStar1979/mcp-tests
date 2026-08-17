# Control-plane snapshots

This directory is a historical archive of point-in-time workflow/runtime copies.

Snapshot contents are not the active source of truth.

`workflow_snapshot.js` resolves the repository root from its own location, writes to a unique `.pending-*` directory, and publishes a complete snapshot with one same-volume rename. Failed or test-only snapshots must not remain in this archive, regardless of the caller's current working directory.

Active workflow truth remains in `_workflow/ACTIVE_WORKFLOW_INDEX.md`, `_workflow/WORKFLOW_CANON.md`, and `_workflow/state.json`.
