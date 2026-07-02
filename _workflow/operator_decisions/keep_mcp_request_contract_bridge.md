# Keep `/mcp` Request-Contract Bridge

Status: GREEN / ADDITIVE REQUEST-CONTRACT BRIDGE APPLIED / HYBRID TRANSITION
Date: 2026-06-30

## Purpose

Move the confirmed per-request request-contract pieces onto the surviving `/mcp` route without guessing the final retirement boundary for legacy `initialize` and transport-session behavior.

## Confirmed repo-applied runtime change

- stable `/mcp` now supports `server/discover`
- `server/discover` on `/mcp` requires:
  - `MCP-Protocol-Version`
  - `_meta.io.modelcontextprotocol/protocolVersion`
  - `_meta.io.modelcontextprotocol/clientInfo`
  - `_meta.io.modelcontextprotocol/clientCapabilities`
- header and `_meta` protocol versions must match
- unsupported per-request protocol version returns JSON-RPC `-32004` with HTTP 400
- legacy `initialize` remains supported on `/mcp`

Evidence:

- `src/runtime/request_metadata_policy.js`
- `src/runtime/server_discover_message_handler.js`
- `src/runtime/mcp_runtime_handlers.js`
- `src/runtime/rpc_message_dispatcher.js`
- `_tests/smoke_keep_mcp_request_contract_bridge.js`

## Confirmed transition boundary

This package is intentionally additive and transitional:

- it does not remove `initialize`
- it does not remove `MCP-Session-Id`
- it does not remove stable transport-session behavior
- it does not claim that `/mcp` is already sessionless/stateless end-state complete

## Confirmed non-actions

- no hidden `/mcp/sessionless` route removal
- no `subscriptions/listen` redesign
- no runtime restart performed by this workflow package
- no connector refresh
- no schema-change claim beyond additive method support and stricter per-request validation for `server/discover`

## Remaining open request-contract debt

- reconcile long-term coexistence of legacy `initialize` with per-request `server/discover`
- remove transport-session dependency from the surviving `/mcp` route
- retire stable `MCP-Session-Id` and initialize-era assumptions
- finish the final no-SSE notification contract

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false
- runtime_restart_required: true
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
