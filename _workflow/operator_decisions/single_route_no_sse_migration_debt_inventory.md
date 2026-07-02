# Single-Route No-SSE Migration Debt Inventory

Status: GREEN / DEBT INVENTORY RECORDED / WORKFLOW-ONLY
Date: 2026-06-30

## Purpose

Record the confirmed repo debt that must be removed or redesigned before the server can reach the single-route, no-SSE, streamable-HTTP target.

The no-SSE destination recorded here is a stricter project target. Current official MCP Streamable HTTP direction still allows request-scoped SSE on POST responses and for `subscriptions/listen`.

## Confirmed debt inventory

### Runtime code

- `src/runtime/accept_policy.js`
  - Explicit `text/event-stream` accept handling is still active.
- `src/runtime/mcp_entry_dispatcher.js`
  - POST path still negotiates SSE response mode.
- `src/runtime/mcp_get_stream_handler.js`
  - Stable GET SSE stream, keepalive, and `Last-Event-ID` handling remain active.
- `src/runtime/create_server_route_dispatcher.js`
  - Hidden `/mcp/sessionless` route remains separately dispatched.
- `src/runtime/sessionless_prototype_route_handler.js`
  - Transitional prototype route remains on `/mcp/sessionless`.
  - `subscriptions/listen` currently returns request-scoped SSE.
- `src/runtime/sse_response.js`
  - Shared SSE response writer remains active.

### Root/runtime specs

- `SERVER_RUNTIME_CONFIG_SPEC.json`
  - Still records a hidden sessionless prototype route and request-scoped SSE `subscriptions/listen`.
- `SERVER_SPEC.json`
  - Sessionless-ready block previously suggested `/mcp/sessionless` as a standard route; corrected to historical transition route.
- `SERVER_EVENT_CATALOG_SPEC.json`
  - Sessionless-ready block previously suggested `/mcp/sessionless` as a standard route; corrected to historical transition route.
- `SERVER_CONNECTOR_SURFACE_SPEC.json`
  - Sessionless-ready block previously suggested `/mcp/sessionless` as a standard route; corrected to historical transition route.

### Active smoke coverage tied to transitional debt

- `_tests/smoke_get_sse_stream.js`
- `_tests/smoke_get_sse_requires_auth.js`
- `_tests/smoke_sse_keepalive.js`
- `_tests/smoke_sse_resumability.js`
- `_tests/replay_gap_guard.js`
- `_tests/smoke_post_sse_response.js`
- `_tests/smoke_sessionless_runtime_prototype.js`
- `_tests/smoke_subscriptions_listen_isolated_validation.js`
- `_tests/smoke_oauth21_sessionless_activation_trial.js`
- `_tests/smoke_workbench_sessionless_standardization.js`

### Workflow/spec interpretation debt

- legacy `sessionless_workbench_standard_route` wording in root specs
- historical connector-migration/coexistence records that can be misread as destination truth
- `_tests` documentation still describes the sessionless track in coexistence-oriented language

## Required later migration buckets

1. Transport cleanup
   - remove `GET /mcp` SSE
   - remove `Last-Event-ID` replay dependence
   - remove POST SSE response mode
2. Route cleanup
   - remove permanent `/mcp` vs `/mcp/sessionless` split
   - retire hidden `/mcp/sessionless` after replacement behavior and coverage exist on `/mcp`
3. Session cleanup
   - remove strategic dependence on `MCP-Session-Id`
   - remove initialize/session dependence from the target path
4. Notification redesign
   - replace request-scoped SSE `subscriptions/listen` behavior with no-SSE streamable HTTP design aligned to the selected single route
5. Coverage cleanup
   - reclassify or retire SSE-specific smoke guards once replacement behavior exists

## Non-actions

- no runtime code change
- no protocol removal
- no restart
- no connector refresh

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
