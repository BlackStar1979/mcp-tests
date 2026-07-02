# S15 Connector Reconnect Execution Evidence On Stable `/mcp`

Status: GREEN / OPERATOR UI STEP EXECUTED / 43 TOOLS CONFIRMED
Date: 2026-06-29

## Purpose

Record the first real connector/UI execution evidence after the S14 approval package, using the stable authenticated endpoint on `/mcp`, with external connector-visible tool-count confirmation.

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

## Confirmed operator-reported UI facts

- The existing authenticated connector was removed in the Codex UI.
- The authenticated connector was added again in the Codex UI.
- The reconnect targeted the stable authenticated endpoint on `/mcp`.
- The UI displayed an authentication prompt.
- The operator clicked the authentication prompt.
- The operator entered the OAuth password in the new window.
- The connector accepted the password.
- Claude Code connector UI confirmed `43` visible tools.
- Claude Code grouped the visible tools as `40` read-only/internal/create and `3` write/delete.

## Confirmed boundaries

- Final visible tool count is confirmed at `43`.
- Connector-visible action list is confirmed as aligned with the authenticated 43-tool surface.
- No connector route migration to `/mcp/sessionless` was performed.
- No OAuth21 3008 restart was required or performed for this UI step.
- No public 3009 start was required or performed for this UI step.
- No stable `/mcp` removal was performed.
- No stable session code removal was performed.

## Repo/runtime truth preserved during the UI step

- Stable authenticated connector target remains `https://mcp-tests-oauth21.romionologic.dev/mcp`.
- Stable route remains `/mcp`.
- Historical transition route remains `/mcp/sessionless`.
- Expected authenticated tool count in repo truth remains `43`.
- Expected authenticated tool-name hash in repo truth remains `8b62ecaf89227335`.

## Next recommendation

S15 is closed as connector reconnect evidence on stable `/mcp`.

Alternative next step after S15 closeout: historical transition-route regression evidence hardening (non-target architecture).
