# Stage 14.9 - Workflow Truth Repair / State Compaction

Status: GREEN / WORKFLOW TRUTH REPAIRED / STATE COMPACTED / NO RUNTIME CHANGE
Date: 2026-06-28

## Purpose

Stage 14.9 repairs the workflow truth layer after Stage 14.5-14.8. It is not a runtime feature stage. It prevents `_workflow/state.json` from becoming a progress log again and records the operator rule for next-step recommendations.

## Operator rule recorded

Every future next-step recommendation must explicitly reassess blockers, connector refresh, OAuth21 workbench server `3008` restart need, and whether `3008` can be restarted by the assistant without asking the operator. Current rule: the assistant may restart TESTS_MCP/OAuth21 workbench server on port `3008` when the active workflow step and operator intent authorize restart. The operator must not be asked to restart `3008`. Connector refresh remains a separate UI/host action and must be requested only when materially required.

## Repairs applied

- `_workflow/state.json`: kept as compact machine-readable orientation map; added source, recommendation policy, current runtime truth and current connector truth; removed active planned work and stage-log-like closeout objects.
- `_workflow/WORKFLOW_CANON.md`: stale Stage 14 boundary is replaced by versioned/superseded boundary; Stage 14.9 and recommendation policy are recorded.
- `_workflow/ACTIVE_WORKFLOW_INDEX.md`: stale active-queue wording is replaced; Stage 14.9 and recommendation policy are recorded.
- `_workflow/sessionless_inventory.json`: stale current claims that OAuth21 `3008` live-load is blocked/pending restart authority are removed while preserving SEP checklist semantics.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git restore affected workflow/test files before commit; git revert after commit
- restore_path: `_workflow/state.json`, `_workflow/WORKFLOW_CANON.md`, `_workflow/ACTIVE_WORKFLOW_INDEX.md`, `_workflow/sessionless_inventory.json`, affected smoke tests

## Non-actions

- no runtime code change
- no server restart
- no connector refresh
- no public `3009` start
- no denial-path probe
- no C3 cancellation work
- no hotplug work
- no sessionless implementation
- no baseline refreeze
- no artificial `list_changed`
- no continuation of progress logging in `state.json`

## Validation

Required validation includes Stage 14.9 guard, compact state guard, Stage 14.7/14.8 guards, sessionless/runtime-topology guards, workflow navigation, matrix check, full run_all skip-network, and git diff check.

## Next recommended step after Stage 14.9

After Stage 14.9, do not jump directly into implementation from stale state. The next recommendation must explicitly reassess blockers, connector refresh, and `3008` restart. If no new runtime-denial probe is required by the operator, the next substantive queue item is Cooperative Tool Cancellation C3.
