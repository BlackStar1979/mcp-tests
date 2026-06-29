# Sessionless / Explicit State Handles Target Selection Preparation

Status: GREEN / TARGET-SELECTION PREPARED / OPERATOR SELECTION PENDING / NO RUNTIME CHANGE
Date: 2026-06-29

## Purpose

Prepare the Sessionless / Explicit State Handles target-selection step without changing runtime behavior. This is not a transport migration and not a session-code removal stage.

## Current-source refresh

Official MCP sources were rechecked on 2026-06-29: SEP-2567, SEP-2575, draft Streamable HTTP, and stable 2025-11-25 Streamable HTTP transport.

Confirmed interpretation: stable 2025-11-25 still documents session-compatible behavior; SEP-2575 directs stateless-first requests and removal of initialize; SEP-2567 removes protocol sessions and treats explicit state handles as ordinary tool result/argument pattern; draft Streamable HTTP direction is POST-only with request-scoped SSE and no protocol-level sessions.

## Prepared target recommendation

Recommended selection for the next operator decision: `keep_stable_connector_current_and_prepare_parallel_draft_sessionless_prototype`.

Meaning: keep current OAuth21 `3008` stable-compatible connector route unchanged; do not remove current session code; prepare a future S4 parallel draft/sessionless prototype behind a non-default route or mode; only after prototype/client evidence decide whether to migrate live connector behavior.

## Blocker reassessment

Removed as stale:

- C1 cancellation context plumbing not implemented;
- C2 response write guard not implemented;
- C3 cooperative cancellation not implemented;
- event-driven hotplug lifecycle not mapped;
- OAuth21 `3008` restart authority missing.

Still valid:

- final operator target selection is required before runtime prototype;
- current live OAuth21 connector should remain stable-compatible;
- parallel draft/sessionless prototype requires a separate runtime-code stage;
- full switch requires connector/client support evidence and refresh plan;
- explicit handle policy must be guarded before handle-bearing tools are added.

## Changes

- Added then superseded `src/sessionless_target_selection_readiness.js`; later correction removed this duplicate projection.
- Added `_tests/smoke_sessionless_target_selection_readiness.js`; after correction it reads `_workflow/sessionless_inventory.json` directly.
- Updated `_workflow/sessionless_inventory.json` as a checklist, not a progress log.

## Declarations

- server_change: false; source read-model only, not runtime-imported by server path
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit

## Non-actions

- no current session code removal
- no POST-only draft mode enabled
- no `server/discover` implementation
- no `subscriptions/listen` implementation
- no live connector route change
- no connector refresh
- no public `3009` start
- no OAuth21 `3008` restart

## Validation

Targeted guards plus full `node _tests/run_all_smokes.js --skip-network` and `git diff --check`.

## Correction

`_workflow/sessionless_inventory.json#target_selection_readiness` is the authoritative sessionless target-selection source. The duplicate `src/sessionless_target_selection_readiness.js` projection was removed by `_workflow/operator_decisions/sessionless_inventory_truth_consolidation.md`.

## Next recommendation

Operator should approve or reject the prepared target selection. Recommendation: approve S4 parallel draft/sessionless prototype behind a non-default route or mode while keeping current OAuth21 stable-compatible connector unchanged. If no runtime prototype is approved yet, proceed to S3 explicit state handle design rules.
