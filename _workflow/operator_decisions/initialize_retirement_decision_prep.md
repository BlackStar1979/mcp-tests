# Initialize Retirement Decision Prep

Status: GREEN / DECISION PREP RECORDED / WORKFLOW-ONLY
Date: 2026-07-13

## Purpose

Record the bounded decision-prep package for eventual retirement of legacy `initialize` on the surviving `/mcp` route.

This record does not authorize removal.

It only defines what must be true before a real retirement decision can be made without guesswork.

## Confirmed current inputs

The current decision-prep baseline is now explicit:

1. Repo/runtime request-flow evidence exists.
   - `_workflow/operator_decisions/initialize_no_handshake_repo_evidence.md`
   - surviving `/mcp` already supports useful no-handshake flow through:
     - `server/discover`
     - `tools/list`
     - `tools/call`

2. The legacy boundary is explicit.
   - `_workflow/operator_decisions/keep_mcp_initialize_retirement_boundary.md`
   - `initialize` is compatibility debt only
   - `server/discover` is the canonical target-facing entry surface

3. Fresh real-client compatibility evidence exists.
   - `_workflow/operator_decisions/initialize_client_compatibility_evidence.md`
   - fresh Codex client evidence still shows:
     - `client_name: "codex-mcp-client"`
     - `client_version: "0.144.2"`
     - legacy `initialize`
     - then `notifications/initialized`
     - then `tools/list`
     - then `tools/call`
   - no matching fresh `server/discover` entry is observed in that same current real-client window
   - newer stale-entry windows that contain only follow-up `tools/list` / `tools/call` traffic must not be misread as fresh entry-path evidence either way

## Current blocker statement

The remaining blocker is now narrow and explicit:

- do not describe retirement as blocked by missing repo/runtime request-flow support
- do not describe retirement as blocked by generic uncertainty
- retirement is currently blocked by real client entry behavior plus missing explicit authorization to remove compatibility debt

## Minimum prerequisites before a real retirement decision

All of the following must be true:

1. Fresh client-path evidence shows that the operationally relevant client family can enter through `server/discover` without relying on legacy `initialize`.
2. That evidence must be fresh for the current client line, not inherited from historical audit entries or older transition routes.
   - a stale-entry window with follow-up traffic but no fresh `initialize` / `server/discover` does not satisfy this requirement
3. The surviving `/mcp` route must continue to prove useful no-handshake flow on the same active runtime:
   - `server/discover`
   - `tools/list`
   - `tools/call`
4. No new target-facing behavior may be added only to the `initialize` path while the decision remains open.
5. A final retirement action must still be separately authorized and guarded before code removal.

## What this prep package enables now

It enables bounded future work such as:

- refreshing real client-path evidence
- tightening blocker wording in workflow docs
- preparing a later removal package only after the blocker changes

It does not enable:

- removing `initialize`
- weakening compatibility for the active Codex client line
- treating historical `server/discover` entries as current retirement authorization

## Safe next interpretation

For now, the safe interpretation is:

- keep bounded dual recognition on `/mcp`
- treat `initialize` as temporary compatibility debt only
- keep `server/discover` as the canonical destination surface
- reopen retirement only when fresh real-client evidence changes

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
