# Keep `/mcp` Residual Session/SSE Cleanup Package

Status: GREEN / REPO CLEANUP + WORKFLOW UPDATED / NO NEW LIVE CHANGE
Date: 2026-07-02

## Purpose

Apply the bounded repo cleanup that removes residual session/SSE helper files no longer reachable from active `/mcp`, without guessing any replacement transport design.

## Confirmed repo cleanup

The following residual helper files were removed from active repo code because they no longer participate in the surviving `/mcp` contract:

- `src/runtime/mcp_get_stream_handler.js`
- `src/runtime/session_store.js`
- `src/runtime/tools_list_changed_emitter.js`

The following dedicated historical debt guards were removed with them:

- `_tests/targeted_debt/replay_gap_guard.js`
- `_tests/targeted_debt/smoke_sse_keepalive.js`
- `_tests/targeted_debt/smoke_sse_resumability.js`
- `_tests/targeted_debt/smoke_tools_list_changed_runtime.js`

Evidence:

- `_tests/smoke_get_sse_stream.js`
- `_tests/smoke_get_sse_requires_auth.js`
- `_tests/smoke_subscriptions_listen_compatibility_matrix.js`
- `_tests/smoke_subscriptions_listen_isolated_validation.js`
- `_tests/smoke_subscriptions_listen_no_sse_project_contract.js`

## Confirmed non-actions

- `src/runtime/session.js` was not removed in this package
- `src/runtime/outbound_request_manager.js` was not removed in this package
- `src/runtime/sampling_context.js` was not redesigned in this package
- no OAuth21 `3008` restart was performed in this package
- no connector refresh was performed in this package

## Active runtime/spec consequences

- stable `GET /mcp` remains `405` and no longer has residual repo-local GET-SSE helper code
- residual `Last-Event-ID` replay helper code is removed from the active repo
- residual runtime push-emitter code for `notifications/tools/list_changed` is removed from the active repo
- any remaining session-bound transport debt is now limited to `McpSession` / outbound pending-response / sampling internals, not to the removed GET-SSE or SessionStore path

## Next safe workflow step

Scope the remaining session-bound outbound/sampling internals (`session.js`, `outbound_request_manager.js`, `sampling_context.js`) and decide what must be retired, redesigned, or explicitly accepted as bounded compatibility debt.

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
