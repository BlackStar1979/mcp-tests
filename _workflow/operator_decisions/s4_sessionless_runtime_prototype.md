# S4 Parallel Draft/Sessionless Runtime Prototype

Status: GREEN / LIVE-LOADED / DEFAULT DISABLED / CONNECTOR SURFACE UNCHANGED
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

Live-load completed on OAuth21 3008. The hidden prototype route remains default-disabled because the running supervisor environment does not enable `MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE`.

## Next recommendation

Proceed to Legacy Retired Auth Test Archive/Cleanup unless the operator explicitly requests S4 route activation testing with the prototype env flag.

## Live-load validation

Status: LIVE-LOADED / DEFAULT DISABLED / CONNECTOR SURFACE UNCHANGED

- Controlled restart requested with `scripts/request-restart.js --reason=s4_sessionless_runtime_prototype_live_load`.
- Previous OAuth21 3008 server_start_id: `2026-06-28T18:29:15.549Z`.
- New OAuth21 3008 server_start_id: `2026-06-29T05:38:06.443Z`.
- Health probe after restart: auth `oauth21`, profile `internal`, tools_count `43`.
- TESTS_MCP runtime status after restart: tool_count `43`, tool_names_hash `8b62ecaf89227335`, combined_fingerprint `476c7d832021acb9`.
- Default-disabled probe: `GET /mcp/sessionless` returned `404 Not found`, because `MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE` is not enabled in the running supervisor environment.
- Connector refresh remains unnecessary because connector-visible tool surface did not change.
