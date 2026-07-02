# Keep `/mcp` Sampling Runtime Detachment Package

Status: GREEN / RUNTIME + WORKFLOW UPDATED / NO LIVE RESTART PERFORMED
Date: 2026-07-02

## Purpose

Remove the inactive sampling-context injection from the surviving `/mcp` runtime path after confirming that active request handling already passes `session: null` and that no active tool/runtime consumer calls `requestSampling`.

## Confirmed repo-applied runtime change

- `src/runtime/mcp_runtime_handlers.js` no longer injects `enrichContextWithSampling(...)` into active request handling
- active `/mcp` request dispatch continues to pass `session: null` through `dispatchMcpEntry`
- `sampling_context.js` remains in repo only as a local helper/tested compatibility module, not as an active surviving-route dependency

Evidence:

- `src/runtime/mcp_entry_dispatcher.js`
- `src/runtime/mcp_runtime_handlers.js`
- `_tests/smoke_mcp_runtime_handlers.js`
- `_tests/smoke_sampling_capability_gate.js`

## Confirmed non-actions

- `src/runtime/sampling_context.js` was not deleted in this package
- `src/runtime/session.js` was not deleted in this package
- `src/runtime/outbound_request_manager.js` was not deleted in this package
- sampling unit tests were not removed in this package
- no OAuth21 `3008` restart was performed in this package
- no connector refresh was performed in this package

## Active runtime/spec consequences

- active `/mcp` no longer carries an inactive sampling helper in request context
- remaining sampling/session/outbound code is now local helper debt rather than active surviving-route runtime wiring
- the next cleanup question is whether those helper modules should be retained as bounded compatibility test fixtures, redesigned, or retired

## Next safe workflow step

Classify `session.js`, `outbound_request_manager.js`, and `sampling_context.js` as either:

- retained local compatibility helpers with explicit non-runtime status
- or a later retirement/redesign package

Do not guess a replacement transport inside this package.

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false
- runtime_restart_required: true
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
