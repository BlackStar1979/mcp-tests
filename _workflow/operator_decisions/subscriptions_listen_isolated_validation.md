# `subscriptions/listen` Isolated Validation

Status: GREEN / ISOLATED HIGHER-PORT VALIDATION PASSED / STABLE ROUTE UNCHANGED
Date: 2026-06-29

## Purpose

Validate the first runtime implementation of `subscriptions/listen` on the hidden sessionless track before any discussion of stable-route migration.

This record is historical transition-debt evidence only. It must not be read as support for current target architecture, because the validated implementation used SSE and hidden-route mechanics that are now explicitly non-target.

Historical status note: this record is hidden-route transition evidence only. It is superseded as active target guidance by `_workflow/operator_decisions/subscriptions_listen_no_sse_project_contract.md` and `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md`. Do not use it as the current next-step plan.

This step is intentionally limited to an isolated local server instance on an ephemeral higher port. It does not touch OAuth21 `3008`, public `3009`, or the stable connector target `/mcp`.

## Validation target

- route: `/mcp/sessionless`
- auth mode: local `oauth` HS256
- activation flag: `MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE=1`
- transport: POST request-scoped SSE stream
- notification path: immediate `notifications/tools/list_changed` when the preloaded tool-surface state is pending
- port selection: ephemeral higher port chosen by the test harness

## Results

- isolated health check returned auth `oauth`, profile `internal`, and 43 tools
- `subscriptions/listen` returned HTTP `200` with `text/event-stream`
- first stream event contained a JSON-RPC success response with `subscribed=true`
- stream response declared POST-only sessionless transport with `protocol_sessions=false` and `request_scoped_stream=true`
- pending tool-surface state produced immediate `notifications/tools/list_changed` on the same request stream
- audit captured `tools_list_changed_emitted` with `stream_target=sessionless_request_stream`
- stable `/mcp` behavior was not changed
- isolated listener was shut down after validation

## Non-actions

- no OAuth21 `3008` restart
- no public `3009` start
- no connector refresh
- no connector route migration
- no stable `/mcp` removal
- no stable session code removal

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit

## Guard

`_tests/smoke_subscriptions_listen_isolated_validation.js`

## Next recommendation

Historical next step at that time: treat the SSE-based implementation as transitional migration debt and define the single-route, no-SSE, streamable-HTTP target contract and migration plan. This record is no longer an active instruction source; the current target authority remains the single-route no-SSE plan on surviving `/mcp`.
