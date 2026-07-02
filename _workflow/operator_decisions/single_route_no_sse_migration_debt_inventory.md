# Single-Route No-SSE Migration Debt Inventory

Status: GREEN / DEBT INVENTORY RECORDED / WORKFLOW-ONLY
Date: 2026-06-30

## Purpose

Record the confirmed repo debt that must be removed or redesigned before the server can reach the single-route, no-SSE, streamable-HTTP target.

The no-SSE destination recorded here is a stricter project target. Current official MCP Streamable HTTP direction still allows request-scoped SSE on POST responses and for `subscriptions/listen`.

## Confirmed debt inventory

### Runtime code still requiring later action

- `src/runtime/accept_policy.js`
  - Historical SSE-oriented accept branches still exist as residual debt even though stable POST `/mcp` is JSON-only and stable GET `/mcp` returns `405`.
- `src/runtime/session.js`
  - Historical transport-session object remains in repo after stable `/mcp` retirement from protocol sessions.
- `src/runtime/outbound_request_manager.js`
  - Session-bound pending-response correlation still exists for historical SSE/session flows that are no longer active on surviving `/mcp`.
- `src/runtime/sessionless_prototype_route_handler.js`
  - Retired hidden-route handler file remains in repo as historical cleanup debt.
- `src/runtime/sse_response.js`
  - Shared SSE response writer remains in repo for residual historical helpers, not for active surviving-route behavior.

### First bounded residual cleanup already completed

- `src/runtime/mcp_get_stream_handler.js`
  - Legacy GET SSE stream, keepalive, and `Last-Event-ID` helper file was removed from the active repo.
- `src/runtime/session_store.js`
  - Historical in-memory transport-session store was removed from the active repo.
- `src/runtime/tools_list_changed_emitter.js`
  - Historical push-style tool-list notifier was removed from the active repo.

### Root/runtime specs

- `SERVER_RUNTIME_CONFIG_SPEC.json`
  - Now records transport-session retirement on stable `/mcp`, but still retains historical hidden-route retirement evidence blocks.
- `SERVER_SPEC.json`
  - Sessionless-ready block still retains historical transition-route evidence for traceability.
- `SERVER_EVENT_CATALOG_SPEC.json`
  - Sessionless-ready block still retains historical transition-route evidence for traceability.
- `SERVER_CONNECTOR_SURFACE_SPEC.json`
  - Sessionless-ready block still retains historical transition-route evidence for traceability.

### Active smoke coverage tied to remaining transitional debt

- `_tests/smoke_post_sse_response.js`
- `_tests/smoke_streamable_http_session_lifecycle.js`
- `_tests/smoke_pending_request_correlation.js`
- `_tests/smoke_sampling_roundtrip.js`
- `_tests/smoke_subscriptions_listen_isolated_validation.js`
- `_tests/smoke_oauth21_sessionless_activation_trial.js`
- `_tests/smoke_workbench_sessionless_standardization.js`

### Workflow/spec interpretation debt

- legacy `sessionless_workbench_standard_route` wording in root specs
- historical connector-migration/coexistence records that can be misread as destination truth
- `_tests` documentation still describes the sessionless track in coexistence-oriented language

## Required later migration buckets

1. Transport cleanup
   - remove residual shared SSE writer paths that no longer serve active `/mcp`
2. Session cleanup
   - scope the remaining session-bound outbound/sampling internals
   - collapse, redesign, or explicitly quarantine session-bound pending-response paths that are no longer part of the intended active `/mcp` contract
3. Historical route cleanup
   - quarantine or remove residual hidden-route runtime files that no longer serve active `/mcp`
4. Coverage cleanup
   - reclassify or retire remaining session-bound historical guards once replacement behavior exists

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
