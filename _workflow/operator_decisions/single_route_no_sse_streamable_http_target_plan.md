# Single-Route No-SSE Streamable HTTP Target Plan

Status: GREEN / TARGET CONTRACT AND MIGRATION PLAN RECORDED / WORKFLOW-ONLY
Date: 2026-06-30

## Purpose

Convert the operator correction into one explicit active target contract so future work does not drift back toward SSE or permanent dual-route coexistence.

## Confirmed current implementation debt

The current repo/runtime still contains transitional behavior that is not the intended destination:

- stable `/mcp` route remains active
- hidden `/mcp/sessionless` prototype route remains present
- `GET /mcp` SSE remains implemented
- `Last-Event-ID` replay semantics remain implemented
- `MCP-Session-Id` remains implemented on the stable-compatible path
- `subscriptions/listen` currently exists only on the prototype path and currently uses request-scoped SSE

This record does not claim those debts are removed.

## Active end-state target contract

The intended target architecture for this server is:

- one MCP route only
- streamable HTTP only
- no SSE
- no `GET /mcp` SSE stream
- no `Last-Event-ID` replay dependency
- no `MCP-Session-Id` transport dependency
- no initialize/session dependency as part of the target protocol direction
- sessionless/stateless request model

The final surviving route is selected separately in `_workflow/operator_decisions/single_route_selection_keep_mcp.md`. The selected surviving route is `/mcp`, and `/mcp/sessionless` is transition-only debt.

## Interpretation rules for historical records

Historical records about S4-S15 remain valid evidence of what was implemented or validated at the time.

They must not be read as meaning that:

- `/mcp/sessionless` is the permanent destination route
- workbench standardization on `/mcp/sessionless` is the final architecture
- connector migration to the prototype route remains the active recommendation
- coexistence hardening is still the correct next step

When historical records conflict with this target contract, this record governs active planning.

## Bounded migration plan

1. Keep current runtime debt explicitly documented as debt, not target.
2. Keep active workflow queue focused on a single-route no-SSE target contract and migration inventory.
3. Inventory all remaining SSE/session transport dependencies in code, tests, and specs.
4. Final surviving route selected: keep `/mcp`.
5. Prepare a removal/migration package for:
   - `/mcp/sessionless` split as permanent architecture
   - `GET /mcp` SSE
   - `Last-Event-ID`
   - `MCP-Session-Id`
   - request-scoped SSE `subscriptions/listen`
6. Keep SEP-2549 `ttlMs` / `cacheScope` inventory aligned with the same target.

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
