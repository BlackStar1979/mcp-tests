# List Result TTL/CacheScope Runtime Package

Status: GREEN / REPO-APPLIED
Date: 2026-07-02

## Purpose

Apply the bounded runtime package for SEP-2549-style `ttlMs` / `cacheScope` on active `tools/call` outputs that are genuinely list/read-like in the current TEST MCP surface.

This package is intentionally conservative:

- it does extend beyond `tools/list`
- it does not claim universal freshness semantics for every tool result
- it does not change mutating, analytical, planning, audit, or execution-style tool outputs

## Source-backed scope decision

Inputs reviewed:

- `_workflow/operator_decisions/sep2549_list_read_cache_inventory.md`
- `SERVER_TOOLS_SPEC.json`
- `src/runtime/tool_result.js`
- `src/runtime/core_tool_call_handlers.js`
- `src/runtime/optional_tool_call_handler.js`
- `src/runtime/tools_call_handler.js`
- `_tests/smoke_tools_list_cache_directives.js`

The earlier inventory established this active boundary:

- `tools/list` already returned `ttlMs: 0` and `cacheScope: "private"`
- there are no active top-level `resources/*` or `prompts/*` MCP handlers in the current dispatcher
- active `tools/call` outputs did not yet share any generic SEP-2549 response layer

The narrow follow-on decision for this package is:

1. keep `tools/list` unchanged
2. add the same top-level cache directives only to active `tools/call` results whose `SERVER_TOOLS_SPEC.json` `operation_class` is list/read-like
3. keep non-list/read-like `tools/call` results unchanged

## Applied runtime rule

Shared runtime freshness is now applied only when a tool belongs to one of these operation classes:

- `read`
- `list`
- `search`
- `metadata`
- `stat`
- `head`
- `task_list`

For those results, the runtime now returns:

- `ttlMs: 0`
- `cacheScope: "private"`

This is implemented through a shared runtime helper rather than duplicated tool-by-tool wiring.

## Explicit non-scope

This package does not apply shared cache directives to operation classes such as:

- `write`
- `state_update`
- `analyze`
- `plan`
- `audit`
- `preflight`
- `verify_receipt`
- `readonly_execute`

Reason:

- those outputs are not uniformly list/read-like
- broadening them would be interpretive, not source-backed
- TEST MCP workflow currently requires conservative extension rather than semantic guessing

## Repo-applied files

- `src/runtime/tool_result_freshness.js`
- `src/runtime/tool_result.js`
- `src/runtime/core_tool_call_handlers.js`
- `src/runtime/optional_tool_call_handler.js`
- `_tests/smoke_tools_list_cache_directives.js`

## Validation target

The smoke coverage for this package confirms:

- `tools/list` still returns `ttlMs: 0` and `cacheScope: "private"`
- shared helper resolves freshness for read/list-like classes
- shared helper does not resolve freshness for non-read/list-like classes
- core `search` response now carries the directives
- optional `fs_list_public` response now carries the directives
- optional `dev_code_audit` response does not gain directives

## Workflow impact

After this package, active repo truth becomes:

- `tools/list` still explicitly returns `ttlMs: 0` and `cacheScope: "private"`
- active `tools/call` results now share the same directives when their `operation_class` is bounded as list/read-like
- there are still no active top-level `resources/*` or `prompts/*` handlers in the stable dispatcher

## Non-actions

- no schema change
- no connector refresh
- no live restart required for repo truth itself
- no claim that clients must refresh UI purely because these directives exist

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
