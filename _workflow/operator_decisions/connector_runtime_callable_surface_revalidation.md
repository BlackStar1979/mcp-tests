# Connector Runtime Callable Surface Revalidation

Status: GREEN / MODEL-RUNTIME CALLABILITY REVALIDATED / WORKFLOW-ONLY
Date: 2026-07-15

## Purpose

Record fresh evidence that the Codex model runtime again exposes callable remote Streamable HTTP tools from the authenticated `workbench` connector, while keeping UI-visible tool enumeration as a separate truth layer that is still not fully re-verified here.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- public_3009_start_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit

## Confirmed model-runtime evidence

The current Codex model runtime can call authenticated `workbench` tools again in this session:

- `mcp__workbench.tool_usage_snapshot()` returned structured data successfully.
- `mcp__workbench.get_info({path:"mcp-tests"})` returned `success: true`.
- The successful `get_info` result reported:
  - `path: "mcp-tests"`
  - `type: "directory"`
  - `root_alias: "work"`

This confirms real callable remote-tool surface in the model runtime, not only connector configuration or CLI-side visibility.

## Confirmed boundaries

- This is not claimed as a fresh full Codex UI visible-tool count proof.
- `connector_ui_visibility_verified_now` therefore remains `false` in `_workflow/state.json`.
- No connector refresh was required for this bounded revalidation step.
- No runtime restart was required for this bounded revalidation step.
- No connector-visible schema change was performed.
- No route, auth, or tool-catalog mutation was performed.

## Path-handling clarification from the same probe

The same revalidation step also confirmed a practical runtime boundary for `workbench` path arguments:

- drive-letter paths such as `C:/Work/mcp-tests` are rejected by `mcp__workbench.get_info(...)`
- workspace-relative paths such as `mcp-tests` are accepted

This is evidence about connector/runtime argument shape, not a product requirement change.

## Interpretation

This record closes only the bounded question of whether remote Streamable HTTP tools are callable again from the model runtime layer.

It does not yet collapse these layers into one:

1. connector configured
2. connector authenticated
3. model runtime callable surface exposed
4. full external UI visible-tool enumeration freshly confirmed

The current state after this record is:

- 1 = true
- 2 = true
- 3 = true
- 4 = still not independently re-verified in this record

## Evidence

- `_workflow/state.json`
- `_workflow/ACTIVE_WORKFLOW_INDEX.md`
- `_workflow/WORKFLOW_CANON.md`
- `mcp__workbench.tool_usage_snapshot()`
- `mcp__workbench.get_info({path:"mcp-tests"})`

