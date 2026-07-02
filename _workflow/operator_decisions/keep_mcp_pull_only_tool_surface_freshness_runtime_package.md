# Keep `/mcp` Pull-Only Tool-Surface Freshness Runtime Package

Status: GREEN / RUNTIME + WORKFLOW UPDATED / RESTART NOT YET PERFORMED
Date: 2026-07-01

## Purpose

Apply the bounded runtime package that aligns active runtime behavior with the already-recorded pull-only tool-surface freshness contract.

## Confirmed repo-applied runtime change

The active runtime code now reflects the pull-only decision:

- surviving `/mcp` no longer advertises `capabilities.tools.listChanged`
- hidden `/mcp/sessionless` no longer implements `subscriptions/listen`
- active bootstrap/runtime path no longer wires a real list-changed emitter into MCP request handling
- `tools/list` remains the only active freshness signal for tool-surface changes, with:
  - `ttlMs: 0`
  - `cacheScope: "private"`
  - tool-surface fingerprint metadata
  - `serverStartId` metadata

Evidence:

- `src/runtime/initialize_response.js`
- `src/runtime/server_discover_message_handler.js`
- `src/runtime/sessionless_prototype_route_handler.js`
- `src/runtime/server_bootstrap_runtime.js`
- `src/runtime/rpc_message_dispatcher.js`
- `src/runtime/tools_list_response.js`

## Confirmed non-actions

- hidden `/mcp/sessionless` route was not removed
- `state/handle/create` was not changed
- `state/handle/read` was not changed
- `state/handle/destroy` was not changed
- `MCP-Session-Id` was not removed from stable compatibility handling
- no connector refresh was performed
- no OAuth21 `3008` restart was performed in this package

## Active runtime/spec consequences

- `subscriptions/listen` on the hidden prototype route is now retired from active runtime
- `tools_list_changed_emitted` is no longer an active runtime event
- tool-surface state persistence remains diagnostic/runtime-observability support only; it is no longer active push-notification wiring
- because runtime code changed but OAuth21 `3008` was not restarted here, live runtime truth must report `restart_required_now: true`

## Remaining blocker after this package

The remaining bounded blocker before hidden-route retirement is the fate of prototype-only `state/handle/*` semantics:

- move onto surviving `/mcp`
- become tool-local patterns
- or retire differently

Do not guess that outcome inside this package.

## Next safe workflow step

Prepare the final `state/handle/*` fate decision required before hidden `/mcp/sessionless` retirement.

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false
- runtime_restart_required: true
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
