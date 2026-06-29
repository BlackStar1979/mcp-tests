# S4 Parallel Draft/Sessionless Runtime Prototype

Status: GREEN / REPO APPLIED / LIVE LOAD REQUIRED / DEFAULT DISABLED
Date: 2026-06-29

## Purpose

Implement a minimal parallel draft/sessionless runtime prototype behind a non-default route/mode while preserving the current stable-compatible OAuth21 connector route.

## Runtime implementation

- Added `src/runtime/state_handle_prototype.js`.
- Added `src/runtime/sessionless_prototype_route_handler.js`.
- Added hidden route `/mcp/sessionless` gated by `MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE`.
- The route is disabled by default.
- The current `/mcp` route remains unchanged.
- Current `tools/list` and connector-visible tool surface remain unchanged.

## Prototype behavior

- POST-only.
- No protocol sessions.
- `initialize` is rejected with `initialize_not_supported_sessionless`.
- `server/discover` exposes prototype capabilities.
- State handles are opaque `esh_` references.
- State handles bind to OAuth subject, client id, audience, profile, and scopes.
- Raw handles are not stored in records or returned in rejection envelopes.
- Expired and revoked handles fail closed.

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false for MCP tool surface; HTTP route spec updated for hidden prototype route
- runtime_restart_required: true for OAuth21 3008 live-load
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit; if live-loaded, restart 3008 through supervisor after revert
- restore_path: git revert this commit; if live-loaded, restart 3008 through supervisor after revert

## Non-actions

- no current `/mcp` route migration
- no current stable session code removal
- no connector-visible tool addition/removal
- no connector refresh
- no public 3009 start
- no production persistence for state handles
- no `subscriptions/listen` implementation

## Validation

- syntax checks for modified runtime files
- `node server.js --self-test`
- `_tests/smoke_s4_sessionless_runtime_prototype.js`
- `_tests/smoke_s3_explicit_state_handle_design_rules.js`
- `_tests/smoke_sessionless_target_selection_readiness.js`
- `_tests/smoke_workflow_state_compact_spec_map.js`
- `_tests/smoke_matrix_check.js`
- full `run_all --skip-network`

## Live-load plan

After commit, restart OAuth21 3008 using `scripts/request-restart.js` with reason `s4_sessionless_runtime_prototype_live_load`. Validate that server start id changes, OAuth21 tool surface remains 43 tools, and connector refresh remains unnecessary.

## Next recommendation

After live-load validation, proceed to Legacy Retired Auth Test Archive/Cleanup unless the operator explicitly requests S4 route activation testing with the prototype env flag.
