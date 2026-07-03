# Initialize No-Handshake Repo Evidence

Status: GREEN / REPO EVIDENCE RECORDED / NO RUNTIME CHANGE
Date: 2026-07-02

## Purpose

Record the repo-side evidence that the surviving `/mcp` route already supports useful request flow without a preceding legacy `initialize` handshake.

This record does not remove `initialize`. It narrows the remaining blocker for `initialize_handshake` from vague repo uncertainty to explicit external compatibility evidence for clients/connectors that still choose to rely on `initialize`.

## Confirmed current repo/runtime truth

On the surviving `/mcp` route:

- `server/discover` already works as the canonical target-facing discovery surface when called with:
  - `MCP-Protocol-Version`
  - per-request `_meta` protocol/client metadata
- `server/discover` reports:
  - `initialize_required: false`
  - `legacy_initialize_supported: true`
  - `protocol_sessions: false`
- active `tools/list` already works on the surviving route without a preceding `initialize`
- active `tools/call` already works on the surviving route without a preceding `initialize`
- this is now guarded by the HTTP dispatch contract smoke on an isolated local server

Evidence:

- `src/runtime/server_discover_message_handler.js`
- `src/runtime/mcp_entry_dispatcher.js`
- `src/runtime/rpc_message_dispatcher.js`
- `_tests/smoke_mcp_dispatch_contract.js`
- `_tests/descriptor_audit.js`
- `_tests/profile_policy_audit.js`
- `_tests/smoke_fs.js`

## Boundary clarification

This record does not claim that all existing connectors or clients have already migrated away from `initialize`.

It means the remaining `initialize_handshake` blocker is now specifically:

- external compatibility evidence for the clients/connectors that matter operationally
- followed by explicit authorization before removing legacy `initialize`

Follow-up evidence:

- `_workflow/operator_decisions/initialize_client_compatibility_evidence.md` now records a confirmed tested-client case where OAuth succeeded but the client still used legacy `initialize` instead of `server/discover`.

It is no longer accurate to describe this ledger item as blocked because the repo lacks a no-handshake request path on the surviving route.

## Workflow consequence

Keep `initialize_handshake` blocked for stable compatibility, but describe the blocker precisely as client/connector evidence rather than missing repo-side implementation.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
