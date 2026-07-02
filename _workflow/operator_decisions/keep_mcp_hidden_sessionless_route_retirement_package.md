# Keep `/mcp` Hidden Sessionless Route Retirement Package

Status: GREEN / REPO-APPLIED / RESTART PENDING
Date: 2026-07-01

## Purpose

Apply the bounded package that retires hidden `/mcp/sessionless` from active runtime code now that the `state/handle/*` fate is fixed.

This package is repo-applied only:

- runtime code changed in repo
- active live OAuth21 `3008` runtime not restarted yet
- connector refresh not required
- public `3009` start not required

## Repo-applied runtime scope

The active runtime package now:

1. removes `/mcp/sessionless` dispatch from active HTTP route wiring;
2. stops constructing the hidden prototype route handler during runtime bootstrap;
3. removes hidden-route entries from active runtime-config truth;
4. removes hidden-route-only audit events from the active event catalog;
5. keeps explicit state handles only as a tool-design pattern decision, not as route-level runtime surface on surviving `/mcp`.

## Explicit non-removals

This package does not:

- restart OAuth21 `3008`;
- claim that live `3008` has already forgotten `/mcp/sessionless`;
- refresh any connector;
- remove historical operator records or historical scripts;
- remove `src/runtime/state_handle_prototype.js`, which remains standalone helper code and historical design evidence for future tool-local handle flows.

## Active truth after this package

- active repo runtime no longer wires `/mcp/sessionless`;
- active repo runtime no longer exposes `MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE` as active runtime config;
- live OAuth21 `3008` may still serve the old hidden route until restart;
- therefore `restart_required_now` remains `true`;
- connector-visible `/mcp` surface remains unchanged, so `connector_refresh_required_now` remains `false`.

## Next safe workflow step

Perform the controlled OAuth21 `3008` restart and bounded live verification needed to load the hidden-route retirement package.

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false
- runtime_restart_required: true
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
