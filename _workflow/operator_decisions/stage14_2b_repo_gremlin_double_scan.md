# Stage 14.2B - Repo Gremlin Double Scan

Status: GREEN / DOUBLE SCAN / NO APPLY
Date: 2026-06-24

## Scope

After Stage 14.2, the repository was scanned twice for hidden developer-workbench gremlins before recommending the next step. This remains no-apply work: no runtime enforcement, no server restart, no connector refresh, no deploy, and no baseline refreeze.

## Pass 1 - semantic debt scan

Searched tracked repository content for stale or risky markers:

- root `_backups` and `workflow_snapshots` references;
- stale current-state counters such as public=8/authenticated=116;
- obsolete active Streamable/OAuth roadmap markers;
- `pending_commit` leftovers;
- accidental `runtime_enforced=true` / `apply_allowed_now=true` markers;
- active scripts still writing backup/snapshot artifacts outside `_workflow/control_plane`.

Findings corrected in this pass:

1. `SERVER_SPEC.json` no longer targets legacy `server.js.bak-*` at root `_backups`; it targets `_workflow/control_plane/retired_root_backups/`.
2. `_workflow/WORKFLOW_CANON.md` no longer lists root `_backups/**` as workflow truth; it says root `_backups/**` is retired and must not be recreated.
3. `_tests/smoke_stage8_52c_preflight_control_plane_guard.js` no longer expects `_backups/deploy*` or `_backups/snapshots`; it expects control-plane deploy records, file backups, and snapshots.
4. `src/truth/project_truth_audit.js` no longer requires an obsolete exact `_backups/snapshots/...stage8_53...` file; it requires the control-plane snapshot root.
5. `_tests/stress_workflow.js` no longer writes stress artifacts to `_backups/workflow_stress`; it writes under `_workflow/control_plane/snapshots/workflow_stress`.

## Pass 2 - structural active-surface scan

Scanned the active `run_all_smoke_scripts.json` manifest and current workflow guards for brittle pins and stale root-backup references.

Findings corrected in this pass:

1. `_tests/smoke_stage14_2_workbench_debt_cleanup.js` no longer pins `state.current_work_package`; it guards durable `state.stage14.stage14_2` markers.
2. `_tests/smoke_stage12_streamable_http_workflow_plan.js` no longer keeps a giant historical whitelist of `current_work_package` values; it now validates the historical artifact and basic state shape.

## Remaining `_backups` references classified as intentional

Remaining tracked `_backups` references are classified as one of:

- `.gitignore` exclusion;
- non-authoritative path examples;
- negative public-filesystem tests;
- no-root-backups guards;
- historical frozen `SERVER_STAGE12.json` snapshots;
- documentation saying root `_backups` is retired and must not be recreated.


Additional corrected gremlins found during manual validation:

6. `_tests/smoke_stage8_52c_preflight_control_plane_guard.js` was a dead Stage8-era smoke reading removed `_workflow/PREFLIGHT.md`, `_workflow/NEXT_CHAT_HANDOFF.md`, `_workflow/WORKING_COURSE.md`, `_workflow/INDEX.md`, and `_stages`; it now functions as a historical control-plane sanity guard.
7. `src/truth/project_truth_audit.js` and `src/truth/code_runtime_map.js` still referenced removed Stage8 workflow files; they now use current workflow truth files and the internal truth parity smoke passes.
8. Remaining old workflow-file references are confined to inactive historical smokes or legacy validation scripts and are not part of active `run_all`.

## Boundary

server_change: false
workflow_change: true
schema_change: true
runtime_restart_required: false
connector_refresh_required: false
backup_required: false
baseline_refreeze_required: false
rollback_path: revert Stage 14.2B doc/test/spec/internal-truth/workflow changes
restore_path: this file, guard, state, canon, active index, manifest, SERVER_SPEC, internal truth audit, and updated tests

## Non-actions

- no runtime enforcement apply
- no runtime-imported server path change
- no server restart
- no connector refresh
- no deploy
- no public connector reconnect
- no allow/deny behavior change
- no tools_call_handler wiring
- no hotplug/list_changed emission
- no sessionless migration
- no baseline refreeze
- no root `_backups` recreation


## Final validation

- `node _tests/smoke_stage14_2b_repo_gremlin_double_scan.js`: ok.
- `node _tests/smoke_stage8_52c_preflight_control_plane_guard.js`: ok after historical control-plane guard rewrite.
- `node _tests/smoke_stage8_53a_truth_parity_internal.js`: ok after internal truth/code-runtime map current-file update.
- `node _tests/smoke_stage12_step38l_repo_layout_contract.js`: ok after current SERVER_SPEC/control-plane rewrite.
- `node _tests/smoke_stage12_streamable_http_workflow_plan.js`: ok.
- `node _tests/smoke_stage14_2_workbench_debt_cleanup.js`: ok.
- `node server.js --self-test`: ok.
- `node _tests/run_all_smokes.js --skip-network`: ok, public=6, tests_authenticated=161.
