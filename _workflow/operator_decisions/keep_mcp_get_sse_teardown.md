# Keep `/mcp` GET SSE Teardown

Status: GREEN / GET SSE TEARDOWN APPLIED / RUNTIME + WORKFLOW UPDATED
Date: 2026-06-30

## Purpose

Apply the bounded teardown package that removes stable `GET /mcp` SSE behavior from the surviving `/mcp` route without guessing later request-contract or notification details.

## Confirmed repo-applied runtime change

- stable `GET /mcp` no longer opens an SSE stream
- stable `GET /mcp` now returns `405 Method Not Allowed`
- stable `GET /mcp` no longer depends on authentication outcome before returning `405`
- stable-route `Last-Event-ID` replay behavior is no longer reachable through `dispatchMcpEntry`

Evidence:

- `src/runtime/mcp_entry_dispatcher.js`
- `SERVER_RUNTIME_CONFIG_SPEC.json#stable_mcp_get_policy`
- `_tests/smoke_get_sse_stream.js`
- `_tests/smoke_get_sse_requires_auth.js`

## Confirmed non-actions

- `src/runtime/mcp_get_stream_handler.js` was not deleted in this package
- request-scoped SSE on the hidden `/mcp/sessionless` prototype route was not changed in this package
- no `subscriptions/listen` redesign was performed
- no `MCP-Session-Id` removal was performed
- no initialize/session contract migration was performed
- no runtime restart was performed by this workflow package
- no connector refresh was performed

## Remaining debt after this package

- dormant GET-SSE helper code still exists in `src/runtime/mcp_get_stream_handler.js`
- historical/helper tests still reference SSE internals outside the stable `/mcp` path
- stable `/mcp` still retains transport-session and initialize-era behavior on POST
- hidden `/mcp/sessionless` still exists as transition-only debt

## Next confirmed implementation-scoping step

Per `_workflow/operator_decisions/keep_mcp_no_sse_replacement_package.md`, the next bounded step is the request-contract migration package for moving confirmed per-request protocol metadata rules onto the surviving `/mcp` route.

This record does not claim that the final no-SSE `/mcp` contract is complete.

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false
- runtime_restart_required: true
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
