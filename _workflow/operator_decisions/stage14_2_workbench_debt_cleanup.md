# Stage 14.2 - Developer Workbench Debt Cleanup Before Apply Design

Status: GREEN / WORKBENCH DEBT CLEANUP / NO APPLY
Date: 2026-06-24

## Scope

Stage 14.2 removes developer-workbench debt identified before any runtime enforcement apply design. It keeps Stage 14 in no-apply mode and records the checks that must precede any later apply design.

## Operator corrections accepted

- Every recommendation must reassess whether each existing blocker still makes sense.
- If a test-server restart or connector refresh becomes necessary, the assistant must say so before acting.
- Snapshot, deploy, rollback, and backup mechanisms belong under `_workflow/control_plane`, not under root `_backups`.
- `_workflow/operator_decisions/post_stage6_operator_decisions_2026-06-21.md` is binding context for public connector, sessionless direction, cancellation, runtime enforcement, hotplug, archive hygiene, and developer commit responsibility.
- `_workflow/baselines` must be considered before connector/tool-surface or baseline-sensitive changes.
- `_workflow/scripts` must be treated as active developer tooling where tests still reference it.

## Stage 14.2 actions

1. Inspected `_workflow/scripts` inventory: 39 files.
2. Confirmed deploy and rollback scripts already write to `_workflow/control_plane`.
3. Confirmed `workflow_snapshot.js` writes to `_workflow/control_plane/snapshots`.
4. Found and fixed `test_mcp_backup.ps1`, which still wrote to root `_backups`; it now writes snapshots under `_workflow/control_plane/snapshots`.
5. Found and fixed active Stage 12 validators that still required `_backups/workflow_snapshots`; they now require `_workflow/control_plane/snapshots`.
6. Moved local ignored root `_backups` to `_workflow/control_plane/retired_root_backups/local_ignored__backups_moved_2026-06-24` and left it out of Git-tracked active memory.
7. Recorded that `.gitignore` still blocks root `_backups/` from returning as tracked repository state.
8. Identified legacy `_workflow/scripts` entries that still reference removed `_workflow/longterm` or `_workflow/policies`; these are historical/non-run_all tools and must not be treated as current Stage 14 workbench gates without a separate archive/rewrite decision.

## Stage 14.2 prerequisites before any later apply design

Before Stage 14.3 or any apply-design package, verify:

1. Whether runtime enforcement still requires the existing blockers or whether any blocker can be retired.
2. Whether the proposed diff touches runtime-imported code and therefore requires restart planning.
3. Whether the proposed diff changes MCP-visible tool descriptors, schema, tool count, auth/profile visibility, or connector contract and therefore requires connector refresh planning.
4. Whether baseline comparison in `_workflow/baselines/stage8_frozen_runtime_baseline.json` is affected.
5. Whether the post-Stage6 binding decisions still constrain the proposal.
6. Whether control-plane backup/snapshot/deploy/rollback records are needed before mutation.

## Boundary

server_change: false
workflow_change: true
schema_change: false
runtime_restart_required: false
connector_refresh_required: false
backup_required: false
rollback_path: revert workflow-script/documentation/state/test-guard changes
restore_path: this file, workflow scripts, workflow canon/index/state, Stage 14.2 guard, and manifest

## Non-actions

- no runtime enforcement apply
- no runtime-imported code change
- no server restart
- no connector refresh
- no deploy
- no public connector reconnect
- no allow/deny behavior change
- no tools_call_handler wiring
- no hotplug/list_changed emission
- no sessionless migration
- no baseline refreeze
- no hard deletion of control-plane evidence


## Final validation

- `node _tests/smoke_stage14_2_workbench_debt_cleanup.js`: ok.
- `node _tests/smoke_stage14_runtime_enforcement_no_apply_package.js`: ok.
- `node _tests/smoke_stage12_oauth_production_hardening_plan.js`: ok after historical next-work guard update.
- `node _tests/smoke_stage12_streamable_http_workflow_plan.js`: ok after historical next-work guard update.
- `node server.js --self-test`: ok.
- `node _tests/run_all_smokes.js --skip-network`: ok, public=6, tests_authenticated=160.
