# MCP Official SDK v2 Interoperability Closeout

Status: GREEN / OFFICIAL CLIENT INTEROP REGRESSION-GUARDED
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

`_tests/smoke_official_sdk_v2_interop.js` starts one auth-free server child on isolated port `3198` with hermetic control and audit paths, then creates a fresh official transport and client for each case:

1. SDK default legacy mode negotiates `2025-11-25` through `initialize`.
2. SDK automatic negotiation selects modern `2026-07-28` through `server/discover`.
3. SDK pinned negotiation uses `versionNegotiation: { mode: { pin: "2026-07-28" } }` and selects the same modern path.

Each case validates the negotiated era and version, lists all `13` public tools, and successfully calls `fs_get_public_info` with valid structured output.

The isolated server audit is part of the assertion surface:

- exactly one `initialize_received` event belongs to the legacy client;
- exactly two `server_discover_received` events belong to the auto and pinned clients;
- all three clients complete `tool_call_end` for `fs_get_public_info`.

This prevents a client-side success result from being mistaken for proof of the intended server entry path.

## Harness correction

The first full-suite run exposed inherited audit-path pollution in the new test. The test now explicitly binds `MCP_TEST_AUDIT_LOG` to its own temporary control root even when `run_all_smokes` supplies a parent audit path. A focused run with a deliberately conflicting inherited path and the subsequent full suite both passed.

## Validation

- focused official SDK interop smoke: GREEN
- focused repository hygiene smoke: GREEN
- full offline suite: `7 public + 271 authenticated`, GREEN
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
