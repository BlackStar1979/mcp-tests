# S14 Connector Refresh Approval Package / No Execution

Status: GREEN / APPROVAL PACKAGE PREPARED / NO CONNECTOR EXECUTION
Date: 2026-06-29

## Purpose

Prepare the explicit operator package for the first connector/UI refresh-equivalent step after S13, using the available Codex UI action of removing and re-adding the authenticated connector. This record does not claim that any connector action, OAuth prompt, or UI validation already occurred.

Historical status note: this record is transition-route evidence only. It is superseded as active target guidance by `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md` and `_workflow/operator_decisions/single_route_selection_keep_mcp.md`. Do not use it as the current next-step plan.

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

## Confirmed repo/runtime truth before any UI action

- Active authenticated connector route remains `/mcp`.
- Historical transition route remains `/mcp/sessionless`.
- Authenticated connector target remains `https://mcp-tests-oauth21.romionologic.dev/mcp`.
- Expected authenticated tool count remains `43`.
- Expected authenticated tool-name hash remains `8b62ecaf89227335`.
- Current connector-map evidence remains `in_sync_43_of_43`.
- No connector-visible schema or auth-mode change was applied in S14.
- No OAuth21 3008 restart is required for this workflow-only package.
- No public 3009 start is required for this workflow-only package.

## Approved operator action model for the next live step

Because Codex UI does not expose a separate refresh button in the current operator environment, the practical refresh-equivalent action is:

1. Remove the existing authenticated TEST MCP connector in the Codex UI.
2. Add the authenticated connector again, targeting the current stable endpoint.
3. Observe whether the UI requests OAuth, password, consent, or no additional prompt.
4. Capture the resulting visible tool list/count and any prompt/error outcome.

This package does not assume that an OAuth/password prompt must appear. That outcome remains unknown until the operator executes the UI step.

## Stable endpoint that must be used for the live UI step

- Connector target: `https://mcp-tests-oauth21.romionologic.dev/mcp`
- Auth mode expectation: `oauth21`
- Stable route expectation: `/mcp`
- Sessionless route must not be used as the connector target in this package.

## Evidence that the operator should report after the live UI step

- Whether remove + add succeeded or failed.
- Whether any OAuth/password/consent prompt appeared.
- If a prompt appeared, whether it was completed successfully.
- Final visible tool count.
- Whether the visible action list appears aligned with the authenticated 43-tool surface.
- Any connector/UI error text if the step fails.

## Non-actions

No connector removal was performed by repo code. No connector add was performed by repo code. No OAuth21 3008 restart, no public 3009 start, no connector route migration, no stable `/mcp` removal, no stable session code removal, and no connector-visible tool surface change were performed.

## Next recommendation

Historical next step at that time:
- Preferred S15: connector reconnect execution evidence on stable `/mcp` using operator-driven remove + add in the Codex UI.
- Alternative S15: historical transition-route regression evidence hardening (non-target architecture).
This is no longer the active queue; current target authority is the single-route no-SSE plan on surviving `/mcp`.
