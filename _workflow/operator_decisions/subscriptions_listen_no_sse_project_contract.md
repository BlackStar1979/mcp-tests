# `subscriptions/listen` No-SSE Project Contract

Status: GREEN / SOURCE-BOUND PROJECT CONTRACT RECORDED / WORKFLOW-ONLY
Date: 2026-06-30

## Purpose

Resolve the active planning ambiguity around `subscriptions/listen`.

Current official MCP transport direction still allows request-scoped SSE for some Streamable HTTP responses, including `subscriptions/listen`.

This repo has a stricter destination accepted by the operator:

- no SSE at all
- one surviving MCP route
- sessionless/stateless target direction

This record defines the binding project contract for that stricter target and prevents future agents from treating the current sessionless prototype stream as the final design.

## Source-backed inputs reviewed

- `_workflow/operator_decisions/p5_sessionless_explicit_state_handles_spec_review.md`
- `_workflow/operator_decisions/subscriptions_listen_compatibility_matrix.md`
- `_workflow/operator_decisions/subscriptions_listen_isolated_validation.md`
- `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md`
- `src/runtime/sessionless_prototype_route_handler.js`
- `src/runtime/tools_list_changed_emitter.js`
- `src/list_changed_notification_bus.js`
- `_tests/smoke_subscriptions_listen_compatibility_matrix.js`
- `_tests/smoke_subscriptions_listen_isolated_validation.js`

## Confirmed official MCP boundary

From the current official sources already reviewed in P5:

- draft Streamable HTTP removes the GET stream endpoint
- draft Streamable HTTP removes protocol-level sessions
- draft Streamable HTTP still allows request-scoped SSE response streams
- draft Streamable HTTP still describes `subscriptions/listen` on a request-response stream

Therefore:

- "no SSE at all" is not a generic MCP requirement
- "no SSE at all" is a stricter TEST MCP project policy

## Binding project contract for TEST MCP

For this repo's final target direction:

- surviving route: `/mcp`
- hidden `/mcp/sessionless` is transition-only debt
- `subscriptions/listen` must not depend on `GET /mcp`
- `subscriptions/listen` must not depend on `MCP-Session-Id`
- `subscriptions/listen` must not depend on `Last-Event-ID`
- `subscriptions/listen` must not use request-scoped SSE in the final project design
- current prototype `subscriptions/listen` stream on `/mcp/sessionless` must not be migrated unchanged onto `/mcp`
- existing dry-run `notifications/tools/list_changed` work remains design input only, not a completed final replacement

## Confirmed non-decisions that must not be guessed

This record does not invent a fake final transport contract where the official sources are silent.

The following remain unresolved and require a separate project-local contract or implementation package before runtime edits:

- exact no-SSE response shape for `subscriptions/listen`
- whether notification delivery remains long-lived, short-lived, polled, or task-backed
- exact client acknowledgment or resume semantics, if any
- exact relationship between `subscriptions/listen` and SEP-2549 `ttlMs` / `cacheScope`
- whether final list-change freshness uses only invalidation, only expiry, or both

Do not guess these points by analogy to SSE, NDJSON, chunked JSON, long-polling, tasks, or another transport without a separate source-backed decision.

## Consequences

- current `subscriptions/listen` prototype remains evidence of transition-only work, not target truth
- no further runtime migration toward `/mcp/sessionless` is justified by the current implementation
- no runtime patch should try to preserve the current SSE listen behavior under a different route name
- the next safe source-backed follow-on step is SEP-2549 `ttlMs` / `cacheScope` inventory for list/read builders

## Non-actions

- no runtime code change
- no route removal
- no restart
- no connector refresh
- no schema change

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
