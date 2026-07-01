# Keep `/mcp` POST Accept JSON-Only Cleanup

Status: GREEN / REPO-APPLIED / NO RESTART YET
Date: 2026-06-30

## Purpose

Apply the first bounded runtime change for the surviving `/mcp` route: stop negotiating SSE responses on stable POST `/mcp`.

## Applied runtime change

Confirmed repo-applied changes:

- stable `evaluatePostAccept` now requires JSON acceptance and no longer requires or negotiates SSE for POST `/mcp`
- stable `dispatchMcpEntry` now forces `responseMode: "json"` for POST `/mcp`

This changes stable `/mcp` POST response negotiation only.

## Explicit non-changes

This package does not yet remove:

- `GET /mcp` SSE stream
- `mcp_get_stream_handler.js`
- `Last-Event-ID` replay semantics
- `MCP-Session-Id`
- hidden `/mcp/sessionless` prototype route
- request-scoped SSE on prototype `subscriptions/listen`
- lower-level SSE helpers that may still exist in code outside the stable `/mcp` POST path

## Source-backed consequence

After this package, stable `/mcp` POST behavior is:

- JSON response path only
- no POST SSE negotiation on the stable route

This package is intentionally narrower than full SSE removal.

## Next recommended step

Prepare and apply the bounded teardown package for:

- `GET /mcp` SSE
- `Last-Event-ID` replay
- stable route dependence on `mcp_get_stream_handler.js`

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false
- runtime_restart_required: true
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
