# Roots / Sampling / Logging Deprecation Closeout

Status: GREEN / WORKFLOW CLOSED
Date: 2026-07-02

## Purpose

Close the `roots_sampling_logging_deprecation` ledger item using existing repo and workflow truth.

No new runtime patch is introduced here. This record resolves the stale `partial` status now that active surviving-route sampling injection is already detached, roots/protocol-logging usage is inventoried, and the remaining sampling helper is explicitly classified as bounded local compatibility coverage rather than active `/mcp` runtime wiring.

## Confirmed current repo truth

The deprecated bucket is no longer unresolved:

- `src/runtime/mcp_runtime_handlers.js` no longer injects sampling into active `/mcp` request context
- `src/runtime/sampling_context.js` remains only as helper/test compatibility coverage
- no active surviving-route roots surface was confirmed
- generic server audit logging exists, but no separate active MCP protocol-logging feature track is currently open

Evidence:

- `_workflow/operator_decisions/keep_mcp_sampling_runtime_detachment_package.md`
- `_workflow/operator_decisions/keep_mcp_local_session_helper_classification.md`
- `_workflow/operator_decisions/roots_sampling_logging_deprecation_inventory.md`
- `_workflow/sessionless_inventory.json`

## Boundary clarification

This closeout does not delete the sampling helper and does not deny the existence of generic server audit logging.

It means this ledger item is complete for current workflow purposes because:

- deprecated roots/sampling/logging usage is inventoried
- no active surviving-route roots surface is pending migration
- no dedicated protocol-logging migration track is pending
- the remaining sampling helper is already bounded as local compatibility/test debt instead of active route behavior

If a future project phase reactivates roots or sampling as target-facing MCP features, that must open a new explicit package instead of leaving this deprecated bucket artificially `partial`.

## Workflow consequence

`roots_sampling_logging_deprecation` in `_workflow/sessionless_inventory.json` should be considered `done`.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
