# S7 SEP-2575 Sessionless Request Contract

Status: GREEN / RUNTIME PATCH ON HIDDEN ROUTE / CONNECTOR UNCHANGED
Date: 2026-06-29

## Purpose

Move `/mcp/sessionless` closer to the latest SEP stateless/sessionless contract by enforcing per-request metadata from SEP-2575 on the hidden sessionless prototype route.

Historical status note: this record is hidden-route transition evidence only. It is superseded as active target guidance by `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md` and `_workflow/operator_decisions/single_route_selection_keep_mcp.md`. Do not use it as the current next-step plan.

## Source refresh

Official SEP index checked on 2026-06-29: Final SEPs remain 41. Core sessionless/stateless SEPs remain SEP-2549, SEP-2567, SEP-2575, SEP-2577, and SEP-2596.

## Runtime contract

On `/mcp/sessionless` when `MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE=1`:

- `MCP-Protocol-Version` header is required.
- `params._meta.io.modelcontextprotocol/protocolVersion` is required.
- Header and `_meta` protocol version must match.
- Supported sessionless version is `2025-06-18`.
- Unsupported versions return JSON-RPC `-32004` and HTTP 400.
- `_meta.io.modelcontextprotocol/clientInfo` is required.
- `_meta.io.modelcontextprotocol/clientCapabilities` is required.
- `server/discover` returns `supportedVersions`, `capabilities`, and `serverInfo`.
- `initialize` remains unsupported.

## Declarations

- server_change: true, hidden route only
- workflow_change: true
- schema_change: false
- runtime_restart_required: false now; future 3008 live-load requires separate activation/restart stage
- connector_refresh_required: false
- backup_required: true via Git commit
- rollback_path: git revert this commit
- restore_path: git revert this commit

## Non-actions

- no `/mcp` behavior change
- no OAuth21 3008 activation of sessionless route
- no connector route migration
- no connector refresh
- no public 3009 start
- no stable session code removal

## Guard

`_tests/smoke_sessionless_sep2575_request_contract.js`

## Next recommendation

Historical next step at that time: proceed to an isolated S8 sessionless activation/regression run on a higher local port using the stricter SEP-2575 request contract. This is no longer the active queue; current target authority is the single-route no-SSE plan on surviving `/mcp`.
