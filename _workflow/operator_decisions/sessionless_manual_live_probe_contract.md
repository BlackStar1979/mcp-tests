# S10A Manual Live Probe Contract

Status: PREPARED / MANUAL EXECUTION REQUIRED / TOOL-LAYER BLOCKED
Date: 2026-06-29

## Purpose

S10 requires a live protected request sequence against OAuth21 3008. The ChatGPT tool layer blocked that protected request sequence before it reached the server. This record prepares a manual evidence contract and does not claim GREEN runtime completion.

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

## Prepared repo artifact

`_workflow/scripts/sessionless_manual_probe_stub.js` is a non-network stub with `--self-test`. It records the manual execution boundary without embedding the blocked protected request sequence.

## Required manual evidence

Manual run outside the ChatGPT tool layer must verify: 3008 health, post-only 405, `server/discover`, explicit state handle create/read, second-client denial without raw handle echo, destroy, revoked read without raw handle echo, and no raw handle in audit.

## Non-actions

No connector refresh, connector route migration, public 3009 start, stable `/mcp` removal, stable session code removal, or OAuth21 3008 restart.

## Guard

`_tests/smoke_sessionless_manual_probe_contract.js`

## Next recommendation

Run the manual probe from the PC shell outside the ChatGPT tool layer and paste sanitized JSON output only.
