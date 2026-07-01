# Keep `/mcp` Sessionless Replacement Coverage Scoping

Status: GREEN / REPLACEMENT COVERAGE SCOPE RECORDED / WORKFLOW-ONLY
Date: 2026-06-30

## Purpose

Define the exact implementation scope that must exist on surviving `/mcp` before hidden `/mcp/sessionless` can be removed.

This record is bounded scoping only:

- no runtime code change
- no route removal
- no restart
- no connector refresh

## Confirmed current split

Current repo truth is still split across two routes:

- surviving `/mcp`
  - stable POST is JSON-only
  - stable GET returns `405`
  - additive `server/discover` exists
  - legacy `initialize` still exists as compatibility
  - transport still reports protocol-session debt

- hidden `/mcp/sessionless`
  - rejects `initialize`
  - exposes `server/discover` with `protocol_sessions: false`
  - exposes `subscriptions/listen`
  - exposes `state/handle/create`
  - exposes `state/handle/read`
  - exposes `state/handle/destroy`

Evidence:

- `src/runtime/rpc_message_dispatcher.js`
- `src/runtime/server_discover_message_handler.js`
- `src/runtime/sessionless_prototype_route_handler.js`
- `src/runtime/create_server_route_dispatcher.js`
- `src/runtime/server_bootstrap_runtime.js`
- `SERVER_RUNTIME_CONFIG_SPEC.json`

## Confirmed replacement scope required before `/mcp/sessionless` retirement

Before hidden `/mcp/sessionless` can be removed, surviving `/mcp` needs source-backed replacement coverage for all prototype-only semantics that remain in scope.

The required scope is:

1. Notification replacement on surviving `/mcp`
   - define the final no-SSE replacement for `subscriptions/listen`
   - do not reuse request-scoped SSE
   - do not guess the transport shape before the contract is explicitly decided

2. State-handle boundary
   - decide whether `state/handle/*` semantics:
     - move onto `/mcp`
     - become tool-local patterns
     - or retire differently
   - do not remove the prototype route before that fate is decided

3. Surviving-route transport truth
   - once replacement behavior exists, surviving `/mcp` transport declarations must stop implying protocol-session dependence as the target model
   - current `server/discover` transition fields are still debt evidence, not the finished end-state

4. Replacement smoke coverage on surviving `/mcp`
   - add bounded guards that validate the chosen no-SSE replacement on `/mcp`
   - add bounded guards for whichever state-handle outcome is selected
   - prove the replacement before deleting the prototype-only route surface

## Explicit non-decisions

This record does not decide:

- the final no-SSE `subscriptions/listen` response/notification contract
- whether `state/handle/*` survives on `/mcp`
- the final removal sequence for runtime files versus specs versus workflow records
- the exact commit package that will delete `src/runtime/sessionless_prototype_route_handler.js`

## Next safe workflow step

Prepare the final no-SSE `subscriptions/listen` contract decision for the surviving `/mcp` route.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
