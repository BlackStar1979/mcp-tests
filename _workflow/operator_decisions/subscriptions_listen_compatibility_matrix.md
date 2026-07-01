# `subscriptions/listen` Compatibility Matrix

Status: GREEN / DESIGN RECORDED / NO RUNTIME CHANGE
Date: 2026-06-29

## Purpose

Record the missing design boundary between the current stable `GET /mcp` SSE model and the future stateless/sessionless `subscriptions/listen` direction.

This is a workflow/design step only. It does not implement `subscriptions/listen`, does not alter the stable connector target, and does not authorize a runtime restart by itself.

Historical status note: this record is hidden-route transition design evidence only. It must not be used as the current next-step plan in place of `_workflow/operator_decisions/subscriptions_listen_no_sse_project_contract.md` and `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md`.

## Inputs reviewed

- `_workflow/operator_decisions/p5_sessionless_explicit_state_handles_spec_review.md`
- `_workflow/sessionless_inventory.json`
- `src/runtime/mcp_get_stream_handler.js`
- `src/runtime/outbound_request_manager.js`
- `src/runtime/sessionless_prototype_route_handler.js`
- `src/runtime/tools_list_changed_emitter.js`
- `_tests/smoke_get_sse_stream.js`
- `_tests/smoke_pending_request_correlation.js`
- `_tests/smoke_tools_list_changed_runtime.js`

## Compatibility matrix

### Stable-compatible route now

- Route: `/mcp`
- Transport shape: session-oriented Streamable HTTP compatibility path
- Long-lived stream entrypoint: `GET /mcp`
- Session binding: `MCP-Session-Id`
- Replay behavior: `Last-Event-ID` accepted and validated
- Server-originated request flow: session pending map plus SSE message delivery
- Tool-surface change notification: dry-run-only `notifications/tools/list_changed`

### Sessionless target direction

- Route family: `/mcp/sessionless`
- Transport shape: POST-only, request-scoped, no protocol session
- Discovery shape: `server/discover`, not `initialize`
- Long-lived change notification target: `subscriptions/listen`
- Session binding: none
- Replay behavior: no new resumable SSE dependency should be introduced
- State continuity: explicit state handles as ordinary tool arguments/results, not transport sessions

## Binding decisions

- Stable `/mcp` remains the live connector target and keeps current compatibility behavior for now.
- Future `subscriptions/listen` work belongs to the sessionless track, not to the stable `/mcp` compatibility route.
- First implementation target must be isolated-port validation on the hidden sessionless path before any OAuth21 stable-route migration discussion.
- `subscriptions/listen` must be POST-scoped and must not depend on `MCP-Session-Id`.
- `subscriptions/listen` must not reintroduce `GET /mcp` or `Last-Event-ID` replay semantics into the sessionless track.
- Existing dry-run `notifications/tools/list_changed` work is design input only; it is not yet live sessionless notification delivery.
- SEP-2549 freshness data such as `ttlMs` and `cacheScope` remains a separate follow-on step and is not closed by this record.

## Non-actions

- no `subscriptions/listen` runtime implementation
- no isolated-port runtime activation in this record
- no stable `/mcp` behavior change
- no connector route migration
- no connector refresh
- no OAuth21 `3008` restart
- no public `3009` start
- no live `notifications/tools/list_changed` emission

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
