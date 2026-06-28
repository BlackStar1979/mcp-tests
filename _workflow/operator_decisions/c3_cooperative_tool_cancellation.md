# C3 - Cooperative Tool Cancellation

Status: GREEN / REPO APPLIED / LIVE RESTARTED ON OAUTH21 3008
Date: 2026-06-28

## Purpose

C3 implements the narrow cooperative cancellation sample from the P3 cancellation plan. C1 and C2 were already present: POST request abort signals are created and propagated, and response writes are skipped after disconnect. C3 adds a cooperative optional-tool execution path that can stop cleanly when `AbortSignal` is already aborted, aborts during `execute`, or is observed immediately after `execute`.

## Changes

- Added `src/runtime/cooperative_tool_cancellation.js`.
- Updated `src/runtime/optional_tool_call_handler.js` to return a controlled JSON-RPC error for cooperative cancellation instead of treating it as an unhandled tool exception.
- Added audit event `tool_call_cancelled_cooperative`.
- Added `_tests/smoke_c3_cooperative_tool_cancellation.js`.

## Blocker reassessment

- Stale C1/C2 blockers: removed; both are already implemented and guarded.
- Restart-authority blocker for OAuth21 `3008`: removed as invalid current blocker; supervisor authority is available.
- Connector refresh blocker: not applicable; no tool names, descriptors, input schemas, output schemas, auth/profile visibility, or tool count changed.

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false for MCP connector-visible schema; event catalog spec updated
- runtime_restart_required: completed for OAuth21 `3008` live-load
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit; restart `3008` only if rollback must become live

## Non-actions

- no connector refresh
- no public `3009` start
- no tool descriptor/schema/name/count change
- no JSON-RPC `$/cancel` implementation
- no sessionless transport migration
- no global session cancellation manager
- no timeout fallback removal

## Validation

- `node _tests/smoke_c3_cooperative_tool_cancellation.js`
- `node _tests/smoke_stage7_c1_cancellation_context_plumbing.js`
- `node _tests/smoke_stage7_c2_client_disconnect_write_guard.js`
- `node _tests/smoke_stage12_pending_request_correlation.js`
- `node _tests/smoke_matrix_check.js`
- `node _tests/run_all_smokes.js --skip-network`
- `git diff --check`

Live validation:

- Controlled restart requested with `node scripts/request-restart.js --reason=c3_cooperative_tool_cancellation_live_load`.
- New OAuth21 3008 `server_start_id`: `2026-06-28T18:29:15.549Z`.
- Runtime status after restart: port `3008`, auth `oauth21`, profile `internal`, tool count `43`, combined fingerprint `476c7d832021acb9`, security boundary `ok`.

## Next recommendation after C3

After C3, reassess blockers before continuing. Current expected next substantive queue item is Event-driven Hotplug Lifecycle, unless live restart validation of C3 fails.
