# No-SSE Single-Route Target Correction

Status: GREEN / TARGET CORRECTION RECORDED / WORKFLOW-TRUTH UPDATE ONLY
Date: 2026-06-30

## Purpose

Correct the active development direction after drift in earlier workflow records.

The operator clarified that the target architecture for this server is:

- no SSE at all
- streamable HTTP only
- sessionless
- stateless
- no permanent dual-route end state

This record corrects the active target. It does not claim that the current runtime already meets that target.

## Correction

The following must be treated as transitional compatibility debt, not as the target architecture:

- stable legacy `/mcp` plus hidden `/mcp/sessionless` dual-track operation
- `GET /mcp` SSE
- `Last-Event-ID` replay semantics
- `MCP-Session-Id`
- request-scoped SSE on `subscriptions/listen`
- "coexistence hardening" as an end-state objective

The intended end state is:

- one MCP route
- no transport session dependency
- no initialize/session dependency
- no SSE
- streamable HTTP only
- sessionless/stateless request model aligned with the latest MCP standards direction accepted by the operator

## Consequence for current repo truth

Current repo/runtime reality may still contain SSE and dual-route transitional behavior. That reality must remain documented as current implementation debt until removed.

However, active planning and next-step recommendations must no longer describe SSE or stable/sessionless coexistence as the desired target.

## Next-step direction

Active next work should follow this order:

1. remove workflow claims that SSE or dual-route coexistence are the intended destination
2. treat current SSE-based `subscriptions/listen` work as temporary migration debt
3. design the single-route, no-SSE streamable HTTP target contract
4. plan migration away from `/mcp` vs `/mcp/sessionless` split
5. plan removal of `GET /mcp` SSE, `Last-Event-ID`, `MCP-Session-Id`, and related session/runtime assumptions

## Non-actions

- no runtime code change
- no restart
- no connector refresh
- no route removal in this record
- no SSE removal in this record

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
