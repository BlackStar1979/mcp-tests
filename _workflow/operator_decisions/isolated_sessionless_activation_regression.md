# S8 Isolated Sessionless Activation Regression

Status: GREEN / ISOLATED HIGHER-PORT ACTIVATION PASSED / CONNECTOR UNCHANGED
Date: 2026-06-29

## Purpose

Run the S7 SEP-2575 sessionless request contract against a real local server instance on a higher port before any OAuth21 3008 activation or connector migration.

Historical status note: this record is hidden-route transition evidence only. It is superseded as active target guidance by `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md` and `_workflow/operator_decisions/single_route_selection_keep_mcp.md`. Do not use it as the current next-step plan.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- public_3009_start_required: false
- backup_required: true via Git commit
- rollback_path: git revert this commit
- restore_path: git revert this commit

## Test target

- port: 3020
- auth: oauth local HS256
- profile: internal
- tools_count: 43
- route: `/mcp/sessionless`
- activation flag: `MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE=1`
- protocol version: `2025-06-18`

## Results

- post_only: GET `/mcp/sessionless` returned 405.
- auth_required: unauthenticated POST returned 401.
- missing_header: authenticated POST without `MCP-Protocol-Version` returned `protocol_version_header_required`.
- version_mismatch: header/meta mismatch returned `protocol_version_mismatch`.
- bad_version: unsupported version returned JSON-RPC `-32004`.
- discover: returned `supportedVersions=[2025-06-18]`, `serverInfo`, capabilities, POST-only transport and no protocol sessions.
- initialize_rejected: `initialize` remains unsupported.
- create/read_owner: `state/handle/create` returned `esh_` and owner read returned payload `{v:8}`.
- deny_other: different subject/client was rejected without raw handle echo.
- destroy/revoked: destroy succeeded and later read returned revoked failure without raw handle echo.
- audit_no_raw_handle: audit had 15 lines and raw handle was not present.
- cleanup: temp directory removed and port 3020 closed.

## Non-actions

- no OAuth21 3008 restart
- no public 3009 start
- no connector refresh
- no connector route migration
- no stable `/mcp` removal
- no stable session code removal

## Guard

`_tests/smoke_isolated_sessionless_activation_regression.js`

## Next recommendation

Proceed to S9 OAuth21 3008 sessionless activation trial only if the operator wants live-load of the hidden route on the workbench server. S9 should still avoid connector migration and should keep `/mcp` stable-compatible.
