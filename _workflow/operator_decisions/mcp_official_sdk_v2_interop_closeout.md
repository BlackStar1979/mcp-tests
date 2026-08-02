# MCP Official SDK v2 Interoperability Closeout

Status: GREEN / OFFICIAL CLIENT NEGOTIATION AND OAUTH INTEROP REGRESSION-GUARDED
Date: 2026-08-02

## Purpose

Replace hand-built request-only confidence with end-to-end proof from the official MCP TypeScript client package against the repository server.

## Upstream authority

- package: `@modelcontextprotocol/client@2.0.0`
- release source: `https://github.com/modelcontextprotocol/typescript-sdk/releases`
- migration source: `https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/support-2026-07-28.md`
- protocol release source: `https://github.com/modelcontextprotocol/modelcontextprotocol/releases/tag/2026-07-28`

The dependency is pinned exactly as a development dependency. It is not imported by the production server.

## Verified paths

`_tests/smoke_official_sdk_v2_interop.js` starts one auth-free server child on a dynamically allocated loopback port with hermetic control and audit paths, then creates a fresh official transport and client for each case:

1. SDK default legacy mode negotiates `2025-11-25` through `initialize`.
2. SDK automatic negotiation selects modern `2026-07-28` through `server/discover`.
3. SDK pinned negotiation uses `versionNegotiation: { mode: { pin: "2026-07-28" } }` and selects the same modern path.

Each case validates the negotiated era and version, lists all `13` public tools, and successfully calls `fs_get_public_info` with valid structured output.

The isolated server audit is part of the assertion surface:

- exactly one `initialize_received` event belongs to the legacy client;
- exactly two `server_discover_received` events belong to the auto and pinned clients;
- all three clients complete `tool_call_end` for `fs_get_public_info`.

This prevents a client-side success result from being mistaken for proof of the intended server entry path.

## Authenticated OAuth21 extension

`_tests/smoke_official_sdk_v2_oauth_interop.js` starts a separate OAuth21 `tests` profile on a dynamically allocated loopback port. Its operator secret, SQLite store, control state, and audit log all live under one temporary root. The test stops that process and starts a second process on the same isolated port and store. It does not bind or restart production port `3008`.

The test implements the official v2 `OAuthClientProvider` contract and proves the complete client/server boundary:

1. An unauthenticated modern connection receives `401` and the SDK performs discovery plus DCR.
2. The SDK creates PKCE S256 authorization material and preserves provider `state` and RFC 8707 `resource` binding.
3. The test host completes the operator-login redirect, validates callback `state`, and passes callback `URLSearchParams` to `finishAuth`, which validates RFC 9207 `iss`.
4. Saved client information and tokens retain the SDK's authorization-server `issuer` stamp.
5. A fresh modern client lists the authenticated surface, confirms representative public/authorized/CBM/memory tools, and calls `get_info` successfully.
6. A second server process loads the registered SDK client plus active access and refresh tokens from the same SQLite store.
7. The saved SDK credentials authorize a modern list/call immediately after process restart without another operator login.
8. After deliberate access-token rejection, a default legacy client refreshes against the restarted process during `initialize`, rotates both tokens, lists/calls successfully, and does not reopen operator authorization.
9. A final fresh modern client reuses the rotated credentials and completes `server/discover`, list, and call without another refresh.

The audit assertions require one accepted operator login, two server starts, a SQLite load containing the registered client plus active tokens, one accepted refresh rotation after restart, three authenticated `server/discover` entries, one authenticated legacy `initialize`, four completed `get_info` calls, and no operator secret, authorization code, PKCE verifier, rejected access token, issued access token, or refresh token in the audit log.

## Harness correction

The first full-suite run exposed inherited audit-path pollution in the new test. The test now explicitly binds `MCP_TEST_AUDIT_LOG` to its own temporary control root even when `run_all_smokes` supplies a parent audit path. A focused run with a deliberately conflicting inherited path and the subsequent full suite both passed.

## Validation

- focused official SDK interop smoke: GREEN
- focused repository hygiene smoke: GREEN
- focused official SDK OAuth21 interop smoke: GREEN in six consecutive runs, including one initial run and a five-run restart stress loop
- full offline suite: `7 public + 272 authenticated`, GREEN
- production port `3008`: not touched
- runtime restart: not required because this package changes only tests, development dependencies, and workflow documentation

## Readiness effect

`COMP-1` remains `3/4`. Server-side compatibility now has stronger independent proof, but operational Codex `0.146.0-alpha.9.2` still enters through legacy `initialize`, so the shim cannot be retired.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- oauth_relogin_required: false
- backup_required: false
- rollback_path: git revert the package commit
- restore_path: git revert the package commit
