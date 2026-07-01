# Keep `/mcp` No-SSE Replacement Package

Status: GREEN / REPLACEMENT PACKAGE SCOPED / WORKFLOW-ONLY
Date: 2026-06-30

## Purpose

Define the confirmed replacement scope for keeping `/mcp` as the surviving route while removing SSE- and session-oriented behavior.

## Confirmed route-retention rule

- `/mcp` survives
- `/mcp/sessionless` is transition-only debt

## Confirmed behavior that must move onto `/mcp`

The following target-direction behavior is already evidenced in repo records and should be treated as the replacement baseline for the surviving `/mcp` route:

- per-request `MCP-Protocol-Version` validation
- per-request `_meta.io.modelcontextprotocol/protocolVersion`
- required `_meta.io.modelcontextprotocol/clientInfo`
- required `_meta.io.modelcontextprotocol/clientCapabilities`
- `server/discover` support
- no protocol sessions
- no initialize/session dependency in the target path

Evidence sources:

- `_workflow/operator_decisions/p5_sessionless_explicit_state_handles_spec_review.md`
- `_workflow/operator_decisions/sessionless_sep2575_request_contract.md`
- `src/runtime/sessionless_prototype_route_handler.js`
- `SERVER_RUNTIME_CONFIG_SPEC.json`

## Confirmed behavior that must be removed from `/mcp`

- `GET /mcp` SSE stream
- POST SSE response negotiation
- `text/event-stream` as a required or supported steady-state transport target
- `Last-Event-ID` replay semantics
- `MCP-Session-Id` transport dependence
- stable/session prototype route split as permanent architecture

Evidence sources:

- `src/runtime/accept_policy.js`
- `src/runtime/mcp_entry_dispatcher.js`
- `src/runtime/mcp_get_stream_handler.js`
- `_workflow/operator_decisions/single_route_no_sse_migration_debt_inventory.md`

## Confirmed unresolved items that must not be guessed

The repo does not yet provide a confirmed final no-SSE runtime contract for these points:

- final response shape for `subscriptions/listen` after removing request-scoped SSE
- whether notification delivery remains immediate per request or changes to another no-SSE pattern
- exact POST accept contract after SSE removal
- exact retirement boundary for old `initialize` handling on the surviving `/mcp` path

These items require separate source-backed confirmation before runtime edits.

## Current official-spec boundary

Current official MCP Streamable HTTP direction still allows request-scoped SSE on POST responses and for `subscriptions/listen`.

This repo's destination is intentionally stricter:

- no SSE even where the generic transport draft still allows it
- keep that stricter rule as project policy, not as a claim about every MCP server

## Recommended next implementation-scoping order

1. final no-SSE `subscriptions/listen` contract decision after current official-source confirmation
2. prototype-route retirement package for `/mcp/sessionless`
3. final initialize-retirement boundary decision for the surviving `/mcp` route
4. SEP-2549 `ttlMs` / `cacheScope` inventory for list/read builders aligned to the same target

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
