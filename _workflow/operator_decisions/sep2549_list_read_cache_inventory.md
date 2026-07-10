# SEP-2549 List/Read Cache Inventory

Status: GREEN / INVENTORY RECORDED / COMPATIBILITY-UPDATED
Date: 2026-07-10

## Purpose

Record the current repo truth for SEP-2549-style `ttlMs` / `cacheScope` across active MCP list/read result builders.

This record is intentionally mechanical. It does not invent new cache policy and does not claim broader coverage than the code really has.

## Inputs reviewed

- `src/runtime/rpc_message_dispatcher.js`
- `src/runtime/tools_list_response.js`
- `src/runtime/tools_list_message_handler.js`
- `src/tools_list_cache_diagnostics.js`
- `SERVER_TOOLS_SPEC.json`
- `_tests/smoke_tools_list_cache_directives.js`
- `_tests/smoke_tools_list_cache_observability.js`

## Confirmed active MCP runtime result builders

The active stable `/mcp` dispatcher currently exposes these MCP methods:

- `initialize`
- `ping`
- `server/discover`
- `tools/list`
- `resources/list`
- `resources/templates/list`
- `prompts/list`
- `tools/call`

Confirmed from `src/runtime/rpc_message_dispatcher.js`:

- there is an active `tools/list` result builder
- there are active compatibility-only `resources/list`, `resources/templates/list`, and `prompts/list` handlers
- there are still no active `resources/read` or `prompts/get` handlers in the current MCP dispatcher

Compatibility meaning:

- top-level MCP resources/prompts remain compatibility-only and do not expose active repo resources or prompts
- each compatibility handler currently returns an empty list
- the compatibility layer exists because real clients were observed calling `resources/list` after `tools/list`

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

### `resources/list`, `resources/templates/list`, `prompts/list`

- builders:
  - `src/runtime/resources_list_message_handler.js`
  - `src/runtime/resource_templates_list_message_handler.js`
  - `src/runtime/prompts_list_message_handler.js`
- responses currently include:
  - `resources: []`
  - `resourceTemplates: []`
  - `prompts: []`
- audit path:
  - emits `resources_list_served`
  - emits `resource_templates_list_served`
  - emits `prompts_list_served`

Interpretation:

- these methods now exist only as a bounded compatibility surface
- they do not expose a real repository resource catalog or prompt catalog
- they are not the place where current repo tool semantics live

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
   - compatibility-only empty-list handlers exist for `resources/list`, `resources/templates/list`, and `prompts/list`
   - no active top-level resource or prompt catalog is exposed
   - `resources/read` and `prompts/get` remain unimplemented
3. `tools/call` list/read-like tool payloads
   - present as tool semantics
   - no shared SEP-2549 response layer yet

## Consequences

- do not claim that list/read freshness is broadly implemented across the repo
- do not claim that `ttlMs` / `cacheScope` are missing everywhere
- current truth is narrower: implemented for `tools/list`, not yet generalized
- the next bounded follow-on step, if needed later, is policy design for whether any `tools/call` list/read outputs should expose analogous freshness semantics

## Non-actions

- bounded runtime code change
- no schema change
- restart required for the live process to pick up the compatibility handlers
- no connector refresh

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false
- runtime_restart_required: true
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
