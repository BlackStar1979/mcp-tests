# Keep `/mcp` Local Session Helper Classification

Status: GREEN / WORKFLOW UPDATED / NO RUNTIME CHANGE
Date: 2026-07-02

## Purpose

Classify the remaining local helper modules after the bounded transport cleanup and sampling-context detachment, without inventing a replacement transport or forcing a speculative redesign.

## Decision

For the current project state:

- `src/runtime/session.js`
  - retained as a local compatibility/helper module for unit coverage around session-bound outbound buffering and pending maps
  - not part of active surviving-route `/mcp` request wiring
- `src/runtime/sampling_context.js`
  - retained as a local compatibility/helper module for sampling policy and helper-level validation
  - not injected into active surviving-route `/mcp` request context anymore
- `src/runtime/outbound_request_manager.js`
  - split in interpretation:
    - `isJsonRpcResponse` / `resolvePendingResponse` still participate in active fail-closed handling of client-sent JSON-RPC response envelopes
    - `sendSessionRequest` remains only a local compatibility/helper path used by tests and helper modules, not by active surviving-route request execution

## Confirmed non-actions

- no helper module was deleted in this package
- no replacement transport was introduced
- no new active `/mcp` capability was added
- no OAuth21 `3008` restart was performed
- no connector refresh was performed

## Consequence for future work

These files should no longer be treated as one unresolved active runtime migration path.

Future work, if reopened, must choose one of:

- explicit retirement/removal package
- focused redesign package
- or continued bounded retention as local compatibility fixtures

Do not describe them as active surviving-route session/runtime wiring anymore.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
