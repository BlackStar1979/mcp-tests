# Keep `/mcp` Initialize Retirement Boundary

Status: GREEN / FINAL LEGACY BOUNDARY RECORDED / WORKFLOW-ONLY
Date: 2026-06-30

## Purpose

Record the final boundary for legacy `initialize` on the surviving `/mcp` route without pretending that removal is already authorized.

This is a workflow-only boundary decision:

- no runtime code change
- no restart
- no connector refresh
- no route removal

## Confirmed current repo truth

On the surviving `/mcp` route, `dispatchRpcMessage` still accepts both:

- `initialize`
- `server/discover`

Current code-backed behavior:

- `initialize`
  - still returns server identity, tool surface, and instructions
  - still negotiates protocol version through legacy initialize semantics
  - still emits `initialize_received` audit evidence
- `server/discover`
  - already carries the additive per-request request-contract bridge
  - already requires `MCP-Protocol-Version`
  - already requires `_meta` protocol/client metadata
  - already reports `legacy_initialize_supported: true`
  - now reports `protocol_sessions: false`

Evidence:

- `src/runtime/rpc_message_dispatcher.js`
- `src/runtime/initialize_message_handler.js`
- `src/runtime/initialize_response.js`
- `src/runtime/server_discover_message_handler.js`
- `src/runtime/request_metadata_policy.js`
- `SERVER_RUNTIME_CONFIG_SPEC.json#stable_mcp_request_contract_bridge`

## Boundary decision

For the surviving `/mcp` route:

1. `initialize` is legacy compatibility only.
   - It is not part of the intended end-state contract.
   - It may remain temporarily for existing connector/client compatibility.

2. `server/discover` is the canonical target-facing request-contract surface.
   - Any new target-facing protocol migration on `/mcp` must anchor on per-request metadata and `server/discover`, not on expanding `initialize`.

3. No new destination architecture dependency may be introduced through `initialize`.
   - do not add new no-SSE transport semantics only to `initialize`
   - do not add new sessionless/stateless requirements only to `initialize`
   - do not make future `/mcp` retirement decisions depend on growing `initialize`

4. While legacy compatibility remains, `initialize` may only preserve already-existing compatibility payloads.
   - server identity
   - tool surface visibility
   - compatibility instructions already emitted by the current response builder

## What this decision does not authorize

This record does not authorize:

- immediate removal of `initialize`
- guessing a final no-SSE `subscriptions/listen` replacement
- removal of hidden `/mcp/sessionless`

## Confirmed blockers before real initialize retirement

Actual `initialize` removal on `/mcp` remains blocked by at least:

1. surviving-route compatibility evidence that required clients/connectors can operate from `server/discover` and per-request metadata without relying on `initialize` as the active handshake
2. final no-SSE replacement behavior for `subscriptions/listen`
3. explicit authorization and coverage for removing legacy `initialize` entirely after compatibility evidence exists

## Next safe workflow step

Prepare the bounded cleanup package for residual session/SSE runtime debt that is no longer reachable from active `/mcp`.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
