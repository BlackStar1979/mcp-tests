# S10B Live Authenticated Sessionless Probe

Status: GREEN / LIVE AUTHENTICATED SESSIONLESS PROBE PASSED / CONNECTOR UNCHANGED
Date: 2026-06-29

## Purpose

Remove the S10 tool-layer blocker by giving the repo a native, agent-safe way to execute the live authenticated `/mcp/sessionless` probe on OAuth21 3008 without manual shell work outside the agent environment.

This is historical transition-route evidence only. The probe remains useful as evidence and harness design, but `/mcp/sessionless` is no longer the active target architecture and is no longer live on OAuth21 `3008`.

Historical status note: this record is hidden-route transition evidence only. It is superseded as active target guidance by `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md` and `_workflow/operator_decisions/single_route_selection_keep_mcp.md`. Do not use it as the current next-step plan.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- public_3009_start_required: false
- backup_required: true via Git commit
- rollback_path: git revert this commit
- restore_path: git revert this commit

## Implemented repo-native path

Added `node _workflow/scripts/sessionless_live_authenticated_probe.js`.

The runner is local-only and test-only. It creates fresh client/token material inside the probe process, does not read durable OAuth state, does not use refresh-token state from `~/.romion/tests_oauth_state.json`, does not print credential material, and does not change connector-visible surface.

Credential sourcing order:

1. explicit `--oauth-secret-file=...` override;
2. best-effort live-process discovery for OAuth21 3008;
3. documented local supervisor secret file fallback `~/.romion/tests_oauth_secret.json`.

All credential material stays in memory inside the probe process for this probe. Output is sanitized JSON booleans/status only.

## Live result

Validated on `http://127.0.0.1:3008` with profile `internal` and `tools_count=43`.

Passed checks:

1. `GET /mcp/sessionless -> 405`.
2. unauthenticated `POST /mcp/sessionless -> 401`.
3. authenticated `server/discover` includes supported version `2025-06-18`.
4. `state/handle/create` returns opaque `esh_` handle.
5. owner read returns payload.
6. second independent client is denied.
7. denial response does not echo raw handle.
8. destroy returns `destroyed=true`.
9. later owner read returns revoked.
10. revoked response does not echo raw handle.
11. appended audit slice does not contain raw handle.

Connector/runtime unchanged during the probe:

- tool_count: `43`
- tool_names_hash: `8b62ecaf89227335`
- combined_fingerprint: `476c7d832021acb9`

## Guard

`_tests/smoke_sessionless_live_authenticated_probe.js`

This guard is non-network and checks the record, the runner self-test, and manifest wiring. The live command remains explicit:

`node _workflow/scripts/sessionless_live_authenticated_probe.js`

## Non-actions

No connector refresh, no connector route migration, no public 3009 start, no stable `/mcp` removal, no stable session code removal, and no OAuth21 3008 restart.
