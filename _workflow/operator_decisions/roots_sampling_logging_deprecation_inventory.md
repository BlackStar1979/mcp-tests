# Roots / Sampling / Logging Deprecation Inventory

Status: GREEN / WORKFLOW UPDATED / NO RUNTIME CHANGE
Date: 2026-07-02

## Purpose

Close the remaining `unknown_needs_inventory` ambiguity for the deprecated SEP-2577 / SEP-2596 bucket by inventorying:

- active sampling usage,
- active roots usage,
- and active protocol-logging usage.

## Findings

### Sampling

- `src/runtime/sampling_context.js` still exists.
- `requestSampling` and `createSamplingContext` are exercised by helper-focused tests such as:
  - `_tests/smoke_sampling_capability_gate.js`
  - `_tests/smoke_sampling_roundtrip.js`
  - `_tests/smoke_sampling_user_approval_policy.js`
- active surviving-route `/mcp` request handling no longer injects sampling into runtime context:
  - `src/runtime/mcp_runtime_handlers.js` now uses a plain copied context
  - no active surviving-route runtime caller was confirmed for `enrichContextWithSampling`

### Roots

- no active surviving-route `/mcp` roots method/route was confirmed in current runtime dispatch
- no dedicated active root spec or runtime handler was found that would make roots part of the current surviving-route target surface

### Protocol logging

- current runtime still has generic server audit logging in `src/runtime/audit_log.js`
- that audit layer is not treated here as an active MCP protocol-logging feature track
- no separate active protocol-logging migration path was confirmed for the surviving `/mcp` route

## Decision

For current workflow truth:

- deprecated roots/sampling/logging inventory is now complete enough to stop using `unknown_needs_inventory`
- this bucket should be treated as:
  - `partial` overall, because the sampling helper module still exists in repo
  - but inventory-complete for roots/protocol-logging usage and active surviving-route sampling wiring

## Confirmed non-actions

- no runtime code path was re-enabled
- no sampling helper was deleted
- no root/protocol logging runtime feature was added
- no OAuth21 `3008` restart was performed
- no connector refresh was performed

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
