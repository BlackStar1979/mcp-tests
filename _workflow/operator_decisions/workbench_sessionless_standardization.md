# S5 Workbench Sessionless Standardization

Status: GREEN / PREPARED / NO RUNTIME CHANGE
Date: 2026-06-29

## Purpose

Prepare deprecation of the previous stable session-based workbench method for new work and standardize the S4 sessionless prototype as the then-current workbench method.

This is not the current end-state contract. It is historical workbench policy evidence that was later superseded by the single-route, no-SSE, streamable-HTTP target on surviving `/mcp`.

Historical status note: this record is hidden-route transition evidence only. It is superseded as active target guidance by `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md` and `_workflow/operator_decisions/single_route_selection_keep_mcp.md`. Do not use it as the current next-step plan.

## Previous method

The previous method is stable Streamable HTTP on `/mcp` using initialize/session compatibility, `MCP-Session-Id`, and GET SSE where applicable. It remains legacy-compatible for existing connector/runtime behavior. It is not removed.

## New workbench standard

The historical standard for workbench experimentation and new sessionless work at that time was the S4 route `/mcp/sessionless` with `MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE=1`, explicit state handles, POST-only behavior, no protocol sessions, and no initialize requirement.

## Scope

S5 is preparation and standardization policy only. It does not enable the hidden route on OAuth21 3008, does not change `/mcp`, does not change the connector-visible tool surface, and does not refresh the connector.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit

## Guarded rules

- `/mcp` remains `legacy_compatible_do_not_remove`.
- `/mcp/sessionless` was the historical standard route for isolated higher-port workbench tests at that stage.
- `MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE` is the required activation flag.
- OAuth21 3008 activation requires a separate explicit operator stage.
- Connector migration requires a separate route/surface decision and connector refresh.
- Stable `/mcp` removal is forbidden until client support and migration evidence exist.

## Evidence

- S4 live-load on 3008 remains default-disabled.
- Isolated port 3019 stress test passed with 900 calls, no failures, and no raw state handle in audit.
- Guard: `_tests/smoke_workbench_sessionless_standardization.js`.

## Next recommendation

Historical next step at that time: proceed to Legacy Retired Auth Test Archive/Cleanup. Do not activate `/mcp/sessionless` on OAuth21 3008 or migrate the connector without a separate explicit operator stage.
