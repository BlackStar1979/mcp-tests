# S6 Legacy Auth Cleanup and Sessionless-Ready Spec Review

Status: GREEN / REPO PREPARED / NO RUNTIME CHANGE
Date: 2026-06-29

## Purpose

Complete Legacy Retired Auth Test Archive/Cleanup and mark workflow/root server specifications as sessionless-ready for the current workbench direction.

Historical status note: this record is archive/spec-posture evidence only. It is superseded as active target guidance by `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md` and `_workflow/operator_decisions/single_route_selection_keep_mcp.md`. Do not use it as the current next-step plan.

## Legacy auth cleanup

- Archived 17 retired access/bearer smoke files under `_tests/archive/legacy_retired_auth/`.
- No hard delete was performed.
- `_tests/legacy_retired_auth_smoke_manifest.json` now records archive paths and cleanup status.
- Active replacement is `_tests/smoke_legacy_retired_auth_negative_controls.js`.

## Sessionless-ready spec review

- All root `SERVER*SPEC.json` files include `sessionless_ready_review`.
- This review is workflow/spec posture only and does not change runtime behavior.
- `/mcp` remains legacy-compatible and must not be removed.
- `/mcp/sessionless` is historical transition-route evidence only.
- `MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE` remains part of the recorded transition history, but the hidden route and env are retired from active runtime truth.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false because files are archived in-repo, not hard-deleted
- rollback_path: git revert this commit
- restore_path: git revert this commit

## Non-actions

- no runtime code patch
- no OAuth21 3008 restart
- no public 3009 start
- no connector refresh
- no connector route migration
- no stable `/mcp` removal
- no hard deletion of legacy auth tests

## Validation

- `_tests/smoke_legacy_retired_auth_negative_controls.js`
- `_tests/smoke_legacy_archive_sessionless_ready_specs.js`
- workflow navigation/state guards
- full `run_all --skip-network`

## Next recommendation

Proceed to CRLF Batch Normalization if still desired. Current assessment: connector refresh is not required, OAuth21 3008 restart is not required, and public 3009 start is not required.
