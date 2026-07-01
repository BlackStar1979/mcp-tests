# SEP-2549 List/Read Cache Inventory

Status: GREEN / INVENTORY RECORDED / WORKFLOW-ONLY
Date: 2026-06-30

## Purpose

Record the current repo truth for SEP-2549-style `ttlMs` / `cacheScope` across active MCP list/read result builders.

This record is intentionally mechanical. It does not invent new cache policy, does not claim broader coverage than the code really has, and does not change runtime behavior.

## Inputs reviewed

- `src/runtime/rpc_message_dispatcher.js`
- `src/runtime/tools_list_response.js`
- `src/runtime/tools_list_message_handler.js`
- `src/tools_list_cache_diagnostics.js`
- `SERVER_TOOLS_SPEC.json`
- `_tests/smoke_tools_list_cache_directives.js`
- `_tests/smoke_tools_list_cache_observability.js`

## Confirmed active MCP runtime result builders

The active stable `/mcp` dispatcher currently exposes only these MCP methods:

- `initialize`
- `ping`
- `server/discover`
- `tools/list`
- `tools/call`

Confirmed from `src/runtime/rpc_message_dispatcher.js`:

- there is an active `tools/list` result builder
- there are no active `resources/list`, `resources/read`, `prompts/list`, or `prompts/get` handlers in the current MCP dispatcher

## Confirmed current cache-directive coverage

### `tools/list`

- builder: `src/runtime/tools_list_response.js`
- response currently includes:
  - `ttlMs: 0`
  - `cacheScope: "private"`
- audit path: `src/runtime/tools_list_message_handler.js`
  - emits `tools_list_cache_directive` with `ttl_ms` and `cache_scope`
- observability path: `src/tools_list_cache_diagnostics.js`
  - reads back the emitted cache directive for audit/diagnostic use

Interpretation:

- cache semantics are currently explicit only for `tools/list`
- current value is effectively "do not reuse without revalidation" / private-client scope
- this is existing repo truth, not a new policy decision from this record

### `server/discover`

- active on `/mcp` after the additive request-contract bridge
- not a list/read result builder for SEP-2549 purposes
- this inventory does not extend `ttlMs` / `cacheScope` to `server/discover`

### `tools/call` tool outputs

Many tool facades in `SERVER_TOOLS_SPEC.json` have operation classes such as `list`, `read`, `search`, or `metadata`, for example:

- `fs_list_public`
- `plugin_registry_list`
- `memory_get_tasks`
- `memory_search`

However, these are payloads behind `tools/call`, not shared MCP top-level result builders.

Confirmed repo boundary:

- there is no current generic runtime layer that injects SEP-2549 `ttlMs` / `cacheScope` into those tool-specific outputs
- any future freshness semantics for those tools must be designed tool-by-tool or via a later shared response contract

## Inventory conclusion

Current active inventory for SEP-2549-style cache directives is:

1. `tools/list`
   - implemented
   - `ttlMs = 0`
   - `cacheScope = private`
2. top-level MCP `resources/*` / `prompts/*`
   - not implemented in current dispatcher
3. `tools/call` list/read-like tool payloads
   - present as tool semantics
   - no shared SEP-2549 response layer yet

## Consequences

- do not claim that list/read freshness is broadly implemented across the repo
- do not claim that `ttlMs` / `cacheScope` are missing everywhere
- current truth is narrower: implemented for `tools/list`, not yet generalized
- the next bounded follow-on step, if needed later, is policy design for whether any `tools/call` list/read outputs should expose analogous freshness semantics

## Non-actions

- no runtime code change
- no schema change
- no restart
- no connector refresh

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
