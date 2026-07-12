# Keep `/mcp` Session-Bound Outbound/Sampling Scope

Status: GREEN / SCOPE RECORDED / WORKFLOW-ONLY
Date: 2026-07-12

## Purpose

Close the workflow-only scoping step referenced by the initialize-retirement boundary without inventing a replacement transport or pretending these helper paths are part of the active surviving `/mcp` contract.

## Confirmed current repo truth

The remaining session-bound outbound/sampling internals are limited to a bounded compatibility/helper layer:

- `src/runtime/session.js`
  - explicitly says active `/mcp` no longer constructs transport sessions
  - still carries replay, outbound queue, and pending-map mechanics inside `McpSession`
- `src/runtime/outbound_request_manager.js`
  - explicitly says active runtime only reuses response-envelope guards there
  - `sendSessionRequest(...)` still builds server-originated outbound envelopes on a session object
  - `resolvePendingResponse(...)` still participates in active fail-closed JSON-RPC response-envelope handling
- `src/runtime/sampling_context.js`
  - explicitly says active `/mcp` no longer injects this into request context
  - still routes helper-level sampling through `sendSessionRequest(...)`
- `src/runtime/mcp_runtime_handlers.js`
  - no longer imports or injects `sampling_context`
  - active surviving-route request handling reaches `dispatchRpcMessage(...)` without sampling-context enrichment

Helper-level coverage still proves these modules behave coherently in isolation:

- `_tests/smoke_pending_request_correlation.js`
  - creates `McpSession` directly and exercises `sendSessionRequest(...)`
- `_tests/smoke_sampling_roundtrip.js`
  - creates helper-level sampling context directly and resolves its pending response through `resolvePendingResponse(...)`
- `_tests/smoke_mcp_runtime_handlers.js`
  - asserts the active runtime handlers do not wire `sampling_context`

## Scope decision

For the current project state:

1. `session.js`, helper-only `sendSessionRequest(...)`, and helper-level sampling roundtrip remain bounded compatibility fixtures.
   - They are not active surviving-route `/mcp` request wiring.
   - They remain acceptable while they are only exercised as local helper coverage or as bounded response-envelope support.

2. `resolvePendingResponse(...)` and JSON-RPC response-envelope validation remain the only active contract-relevant part of this area.
   - That path still matters because active POST handling must fail closed on malformed or unknown response envelopes.
   - This does not reactivate transport-session lifecycle as part of the target contract.

3. The remaining open work here is no longer "discover what still depends on session semantics".
   - That scoping step is now complete.
   - Any future change must be framed explicitly as one of:
     - helper retirement/removal
     - focused helper redesign
     - or continued bounded retention

## Non-actions

- no runtime code change
- no restart
- no connector refresh
- no new transport semantics
- no helper deletion

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
