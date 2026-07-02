# S9 OAuth21 3008 Sessionless Activation Trial

Status: GREEN / LIVE 3008 HIDDEN ROUTE ACTIVE / CONNECTOR UNCHANGED
Date: 2026-06-29

## Purpose

Activate the hidden `/mcp/sessionless` route on the OAuth21 3008 workbench runtime after S8 isolated regression passed, without connector migration and without changing stable `/mcp`.

This is historical activation evidence only. The hidden route has since been retired from active repo runtime and verified absent on live OAuth21 `3008`.

Historical status note: this record is hidden-route transition evidence only. It is superseded as active target guidance by `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md` and `_workflow/operator_decisions/single_route_selection_keep_mcp.md`. Do not use it as the current next-step plan.

## Declarations

- server_change: true, hidden route activation path and live child-process restart
- workflow_change: true
- schema_change: false
- runtime_restart_required: true and completed by supervisor/request-restart
- connector_refresh_required: false
- public_3009_start_required: false
- backup_required: true via Git commit
- rollback_path: remove `_control/sessionless-prototype.json`, restart 3008 by `scripts/request-restart.js`, then git revert this commit if code rollback is required
- restore_path: recreate `_control/sessionless-prototype.json`, restart 3008 by `scripts/request-restart.js`


## Activation method

Controlled restart through scripts/request-restart.js completed. Restart request manual-1782724080332 used controlled exit code 42. Activation marker file under _control enabled the hidden sessionless route.

## Live evidence

3008 healthz returned internal profile and 43 tools. Runtime status reported port 3008, auth oauth21, profile internal, server_start_id 2026-06-29T09:08:02.097Z, tool hash 8b62ecaf89227335, and combined fingerprint 476c7d832021acb9. GET /mcp/sessionless returned 405 sessionless_prototype_post_only. Unauthenticated POST returned 401 missing_bearer_token.

## Non-actions

No connector refresh, no connector route migration, no public 3009 start, no stable /mcp removal, and no stable session code removal.

## Guard

_tests/smoke_oauth21_sessionless_activation_trial.js

## Next recommendation

Historical next step at that time: proceed to S10 live authenticated SEP-2575 probes on OAuth21 3008, still without connector migration and without removing stable `/mcp`. This is no longer the active queue; current target authority is the single-route no-SSE plan on surviving `/mcp`.
