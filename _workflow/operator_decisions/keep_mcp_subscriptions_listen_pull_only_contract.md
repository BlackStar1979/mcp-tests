# Keep `/mcp` `subscriptions/listen` Pull-Only Contract

Status: GREEN / FINAL NO-SSE CONTRACT RECORDED / WORKFLOW-ONLY
Date: 2026-06-30

## Purpose

Close the remaining ambiguity around `subscriptions/listen` on the surviving `/mcp` route without inventing a fake no-SSE push transport.

This is a workflow-only contract decision:

- no runtime code change
- no restart
- no connector refresh
- no route removal

## Confirmed official MCP boundary

Current official MCP direction still allows `subscriptions/listen` in Streamable HTTP flows.

The important current boundary for this repo is narrower:

- server support is selective rather than mandatory for every notification family
- tool-list freshness can also be expressed by ordinary `tools/list` responses with `ttlMs` / `cacheScope`
- current official direction does not force TEST MCP to invent a replacement push transport when the project explicitly forbids SSE

Therefore this repo can choose a no-SSE, pull-only contract for tool-surface freshness without claiming that every MCP server must do the same.

## Confirmed repo facts

Current repo/runtime evidence is still transitional:

- hidden `/mcp/sessionless` prototype currently exposes `subscriptions/listen`
- that prototype path still uses request-scoped SSE
- stable `/mcp` still reports transitional `capabilities.tools.listChanged`
- active `tools/list` already returns:
  - `ttlMs: 0`
  - `cacheScope: "private"`
  - tool-surface fingerprint metadata
  - `serverStartId` metadata

Evidence:

- `src/runtime/sessionless_prototype_route_handler.js`
- `src/runtime/server_discover_message_handler.js`
- `src/runtime/initialize_response.js`
- `src/runtime/tools_list_response.js`
- `src/runtime/tools_list_message_handler.js`
- `_workflow/operator_decisions/sep2549_list_read_cache_inventory.md`

## Binding final contract for surviving `/mcp`

For tool-surface freshness on the final surviving `/mcp` route:

1. `subscriptions/listen` is not part of the end-state TEST MCP contract.
   - TEST MCP will not preserve the current prototype `subscriptions/listen` behavior on `/mcp`.
   - TEST MCP will not replace it with another invented push channel in this workstream.

2. `notifications/tools/list_changed` is not an end-state `/mcp` delivery promise.
   - end-state `/mcp` must not advertise tool-list push as an active contract
   - transitional push/readiness evidence remains historical debt only

3. End-state tool-surface freshness is pull-only.
   - authoritative source: `tools/list`
   - freshness signal: `ttlMs: 0`
   - cache scope: `cacheScope: "private"`
   - observability evidence: tool-surface fingerprint metadata and `serverStartId`
   - client refresh model: refetch `tools/list`

4. This decision is specific to current TEST MCP tool-surface freshness.
   - it does not promise or forbid every future notification family unrelated to the current tool-surface contract
   - any future non-SSE server-initiated notification design would require a separate explicit decision

## Consequences

- hidden `/mcp/sessionless` `subscriptions/listen` SSE is confirmed transition-only debt
- stable `/mcp` target contract should converge toward `capabilities.tools.listChanged = false`
- stable `/mcp` target contract should converge toward `subscriptions/listen` unsupported for tool-surface freshness
- tool-surface change detection must rely on `tools/list` re-fetch plus current cache/fingerprint metadata, not on a push stream

## Next safe workflow step

Prepare the bounded runtime package that removes prototype-only `subscriptions/listen` / push debt and aligns `/mcp` freshness signaling to the pull-only contract.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
