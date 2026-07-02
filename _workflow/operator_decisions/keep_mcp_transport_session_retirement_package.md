# Keep `/mcp` Transport-Session Retirement Package

Status: GREEN / RUNTIME + WORKFLOW UPDATED / RESTART NOT YET PERFORMED
Date: 2026-07-02

## Purpose

Apply the bounded runtime package that removes active transport-session dependence from the surviving `/mcp` route while preserving legacy `initialize` as a stateless compatibility RPC.

## Confirmed repo-applied runtime change

The active runtime code now reflects the stateless direction on surviving `/mcp`:

- stable `POST /mcp` no longer creates a transport session during `initialize`
- stable `POST /mcp` no longer returns `Mcp-Session-Id`
- stable `POST /mcp` no longer rejects unknown or invalid `Mcp-Session-Id` as an active protocol dependency
- stable `server/discover` now reports `protocol_sessions: false`
- legacy `initialize` remains supported only as compatibility and still negotiates its response protocol version

Evidence:

- `src/runtime/mcp_entry_dispatcher.js`
- `src/runtime/mcp_runtime_handlers.js`
- `src/runtime/server_discover_message_handler.js`
- `_tests/smoke_streamable_http_session_lifecycle.js`

## Confirmed non-actions

- legacy `initialize` was not removed
- `GET /mcp` behavior was not changed in this package; it still returns `405`
- historical SSE/session helper modules were not fully deleted in this package
- no connector refresh was performed
- no OAuth21 `3008` restart was performed in this package

## Active runtime/spec consequences

- surviving `/mcp` is now stateless with respect to transport-session lifecycle
- `MCP-Session-Id` is no longer part of the active surviving-route contract
- `server/discover` is now aligned with the already-recorded no-session target direction
- pending-response/session-SSE internals that remain in repo are now residual historical debt, not active surviving-route behavior

## Remaining bounded cleanup after this package

The next bounded cleanup should remove residual unreachable session/SSE internals that are no longer part of active surviving-route behavior, without guessing any new transport design.

Examples of residual debt:

- `src/runtime/session.js`
- `src/runtime/session_store.js`
- `src/runtime/mcp_get_stream_handler.js`
- session-bound pending-response paths that are no longer reachable from active `/mcp`

## Next safe workflow step

Prepare the bounded cleanup package for residual session/SSE runtime debt that is no longer reachable from active `/mcp`.

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false
- runtime_restart_required: true
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
