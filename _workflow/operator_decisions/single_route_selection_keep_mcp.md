# Single-Route Selection: Keep `/mcp`

Status: GREEN / FINAL SURVIVING ROUTE SELECTED / WORKFLOW-ONLY
Date: 2026-06-30

## Purpose

Select the final surviving MCP route for the single-route, no-SSE, streamable-HTTP target.

## Decision

The final surviving route is:

- `/mcp`

The following route is explicitly not the final destination:

- `/mcp/sessionless`

## Source-backed basis

This selection is based on current repository truth already present in active specs and workflow files:

- `SERVER_CONNECTOR_SURFACE_SPEC.json`
  - authenticated OAuth21 connector endpoint is `https://mcp-tests-oauth21.romionologic.dev/mcp`
  - authenticated connector path is `/mcp`
- root `SERVER_*_SPEC.json` sessionless-ready review blocks
  - current stable route is `/mcp`
- `_workflow/sessionless_inventory.json`
  - stable connector current target remains the current OAuth21 stable-compatible route
- active workflow correction records
  - `/mcp/sessionless` is already treated as historical transition debt, not target

## Consequence

From this point forward:

- all single-route target planning must assume `/mcp` survives
- `/mcp/sessionless` is transition-only and should be removed in a later bounded implementation package
- no future workflow record may describe `/mcp/sessionless` as the intended final route
- no future migration package should be framed as connector migration toward `/mcp/sessionless`

## Immediate migration implications

The target is not "keep current `/mcp` behavior unchanged".

The target is:

- keep `/mcp` as the surviving path
- remove SSE behavior from that path
- remove `GET /mcp` stream semantics
- remove `Last-Event-ID` replay semantics
- remove `MCP-Session-Id` transport dependence
- remove initialize/session dependence from the target protocol path
- replace transition-only `/mcp/sessionless` behavior with final single-route behavior on `/mcp`

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
