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
    - latest 2026-07-17 repo-native report further confirms:
      - current runtime slice on `server_start_id 2026-07-16T17:49:38.692Z` is `initialize_only`
      - `codex-mcp-client 0.145.0-alpha.18` receives `2` successful legacy `initialize` responses in that current window
      - no matching fresh `server/discover` entry is observed in that same current window
      - retained broader real-client families such as `codex-mcp-client 0.144.2`, `openai-mcp 1.0.0`, and `Anthropic/ClaudeAI 1.0.0` still remain `initialize_only`
      - observed `server_discover_only` evidence in that broader file is synthetic validation traffic rather than an operational client family
      - refreshed report classification now separates:
        - `operational_known`
        - `synthetic_validation`
        - `unknown`
    - latest 2026-07-17 blocker-matrix evidence further sharpens the retained-evidence interpretation:
      - `1d` retained operational blocker set:
        - `codex-mcp-client 0.145.0-alpha.18`
      - `2d` retained operational blocker set:
        - `codex-mcp-client 0.145.0-alpha.18`
        - `codex-mcp-client 0.144.2`
      - `7d` retained operational blocker set expands to:
        - `openai-mcp 1.0.0`
        - `codex-mcp-client 0.144.1`
        - `Anthropic/ClaudeAI 1.0.0`
        - `Anthropic/Toolbox 1.0.0`
        - `codex-mcp-client 0.144.0-alpha.4`
      - `30d` / `all` still remain initialize-only across the wider historical tail
      - so the blocker is not only historical residue; it remains present in the freshest operational windows too

## Current blocker statement

The remaining blocker is now narrow and explicit:

- do not describe retirement as blocked by missing repo/runtime request-flow support
- do not describe retirement as blocked by generic uncertainty
- retirement is currently blocked by real client entry behavior plus missing explicit authorization to remove compatibility debt
- when discussing retained evidence, say which freshness window is meant; do not collapse `1d`, `2d`, `7d`, and `all` into one implied blocker set

## Minimum prerequisites before a real retirement decision

All of the following must be true:

1. Fresh client-path evidence shows that the operationally relevant client family can enter through `server/discover` without relying on legacy `initialize`.
2. That evidence must be fresh for the current client line, not inherited from historical audit entries or older transition routes.
   - a stale-entry window with follow-up traffic but no fresh `initialize` / `server/discover` does not satisfy this requirement
   - a wider retained window may still be useful for risk framing, but it cannot substitute for fresh current-line evidence
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
- comparing blocker persistence across freshness windows before drafting any retirement package
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
