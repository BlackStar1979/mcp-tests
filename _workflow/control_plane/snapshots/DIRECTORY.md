# DIRECTORY

Status: control-plane snapshots directory map
Updated: 2026-08-17

- `stage*_*.`, `post_stage*`, `p*`, and timestamped named operational directories
  Point-in-time workflow/control-plane snapshots retained as archival evidence.

- `.pending-*`
  Transactional staging directories used only during snapshot creation. They are atomically renamed on success and removed on failure; none should persist at rest.

Snapshot contents may preserve superseded files, routes, and stage-era assumptions. They are archival evidence only, not active truth.
