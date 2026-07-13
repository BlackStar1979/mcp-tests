# Initialize Client Compatibility Evidence

Status: GREEN / CLIENT EVIDENCE REFRESHED / WORKFLOW-ONLY
Date: 2026-07-12

## Purpose

Record real client compatibility evidence for legacy `initialize` on the surviving `/mcp` route, and define the bounded compatibility interpretation so future work does not misread this as authorization for a permanent dual-standard architecture.

## Test setup

An isolated OAuth21 workbench fork was started on fresh local ports with:

- one surviving route: `/mcp`
- Streamable HTTP connector type in Codex desktop UI
- no hidden `/mcp/sessionless`
- no active transport sessions
- legacy `initialize` intentionally disabled in one fork to test true no-handshake client behavior

The tested connector path was refreshed by:

- removing the prior connector entry
- re-adding a new connector with a new port and a new connector name
- completing a fresh OAuth password prompt for the new port

## Confirmed client evidence

The tested Codex desktop connector now provides two distinct evidence points:

1. Fresh OAuth authorization succeeds on the new Streamable HTTP connector.
   - `oauth21_operator_login_accepted`
   - `oauth21_state_saved`
   - `oauth21_access_token_accepted`

2. After successful authorization, the tested client still enters through legacy `initialize`.
   - observed authenticated `POST /mcp` requests with `method: "initialize"`
   - no observed authenticated `server/discover`
   - later observed normal follow-up traffic on the same surviving route:
     - `notifications/initialized`
     - `tools/list`
     - `tools/call`

This means:

- auth success alone does not imply migration to the no-handshake request contract
- at least one real client/connector still depends on legacy `initialize` after OAuth succeeds
- repo-side no-handshake support is not enough to remove legacy `initialize` from the compatibility surface today

## Fresh evidence refresh on 2026-07-12

Current authenticated audit evidence continues to confirm the same compatibility blocker on the surviving `/mcp` route:

- observed authenticated `POST /mcp` requests with `method: "initialize"`
- observed authenticated `initialize_received` events for:
  - `client_name: "codex-mcp-client"`
  - `client_version: "0.144.1"`
- observed follow-up authenticated traffic on the same route for the same real client family:
  - `notifications/initialized`
  - `tools/list`
  - `tools/call`
- no observed authenticated `server/discover` entries in the same current audit window

This refresh matters because it removes ambiguity about drift since the earlier 2026-07-03 record:

- the blocker is still present on a newer Codex desktop client line
- the real client can still operate normally after legacy `initialize`, so the compatibility blocker is now specifically about the entry path rather than a broader post-auth runtime failure
- the current compatibility interpretation remains justified
- initialize retirement on the surviving route is still blocked by real client behavior, not by missing repo support

## Compatibility interpretation

This record authorizes only a bounded compatibility interpretation on the surviving `/mcp` route:

1. Keep one route only: `/mcp`.
2. Keep one auth boundary only.
3. After auth, tolerate either client entry style:
   - legacy `initialize`
   - modern `server/discover`
4. Route both entry styles into the same surviving server/tool surface.

This is a bounded compatibility shim, not dual-target architecture.

## What this record explicitly does not authorize

This record does not authorize:

- permanent dual-standard protocol direction
- making `initialize` part of the intended end-state contract
- reintroducing SSE or `GET /mcp` stream behavior as target architecture
- reintroducing hidden `/mcp/sessionless` as a destination route
- adding new target-facing capabilities only to the `initialize` path

## Active rule for future work

Until newer client evidence exists, the surviving `/mcp` route may keep bounded dual recognition of:

- legacy `initialize`
- modern `server/discover`

But:

- `server/discover` remains the canonical target-facing request-contract surface
- `initialize` remains compatibility debt only
- any new destination behavior must be specified on the `server/discover` path, not by growing `initialize`

## Evidence

- `_workflow/operator_decisions/initialize_no_handshake_repo_evidence.md`
- `_workflow/operator_decisions/keep_mcp_initialize_retirement_boundary.md`
- `src/runtime/rpc_message_dispatcher.js`
- `src/runtime/server_discover_message_handler.js`
- `C:\\Users\\mczyz\\AppData\\Local\\Temp\\mcp-tests-fork-audit-3022.jsonl`
- `_logs/.mcp-tests-audit.jsonl`

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
