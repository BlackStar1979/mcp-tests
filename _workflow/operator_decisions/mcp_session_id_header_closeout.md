# MCP-Session-Id Header Closeout

Status: GREEN / WORKFLOW CLOSED
Date: 2026-07-02

## Purpose

Close the `mcp_session_id_header` ledger item using existing repo truth.

No new runtime patch is introduced here. This record formalizes that the surviving stable `/mcp` route no longer treats `MCP-Session-Id` as active protocol state.

## Confirmed current repo truth

On the active stable `/mcp` route:

- `initialize` no longer creates an `MCP-Session-Id` response header
- stable POST `/mcp` no longer depends on session-header presence or validity
- incoming session headers are ignored rather than treated as active protocol state
- `server/discover` reports `protocol_sessions: false`

Evidence:

- `src/runtime/mcp_entry_dispatcher.js`
- `src/runtime/server_discover_message_handler.js`
- `_workflow/operator_decisions/keep_mcp_transport_session_retirement_package.md`
- `_tests/smoke_mcp_dispatch_contract.js`

## Boundary clarification

This closeout applies only to the transport header as an active surviving-route protocol dependency.

It does not claim that every historical helper touching session-oriented objects is removed from the repo. That remaining helper debt belongs to the separate `session_store` / local-compatibility classification boundary.

## Workflow consequence

`mcp_session_id_header` in `_workflow/sessionless_inventory.json` should be considered `done` for the active stable `/mcp` contract.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
