# Sessionless Prototype Route Retirement Scoping

Status: GREEN / SCOPING RECORDED / WORKFLOW-ONLY
Date: 2026-06-30

## Purpose

Define the exact retirement scope for the hidden `/mcp/sessionless` prototype route without pretending that the repo is already ready to remove it.

This record is bounded scoping only:

- no runtime code change
- no route removal
- no restart
- no connector refresh

## Confirmed current retirement target

The route to be retired later is:

- `/mcp/sessionless`

Current role:

- hidden transition-only prototype route
- gated by `MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE`
- not the surviving route
- not the connector target
- not the final project architecture

## Confirmed active code and config touchpoints

### Runtime wiring

- `src/runtime/sessionless_prototype_route_handler.js`
  - owns the `/mcp/sessionless` route
  - owns hidden-route `server/discover`
  - owns hidden-route `subscriptions/listen`
  - owns prototype `state/handle/*`
- `src/runtime/create_server_route_dispatcher.js`
  - dispatches `/mcp/sessionless` before `/mcp`
- `src/runtime/server_bootstrap_runtime.js`
  - creates the prototype handler

### Runtime config/spec truth

- `SERVER_RUNTIME_CONFIG_SPEC.json`
  - route appears in `http_routes`
  - env appears in `env_vars`
  - `sessionless_prototype` block documents current route/env/behavior
- root sessionless-ready review blocks in:
  - `SERVER_SPEC.json`
  - `SERVER_RUNTIME_CONFIG_SPEC.json`
  - `SERVER_CONNECTOR_SURFACE_SPEC.json`
  - `SERVER_EVENT_CATALOG_SPEC.json`

### Active workflow/test evidence tied to the route

- `_tests/smoke_sessionless_runtime_prototype.js`
- `_tests/smoke_oauth21_sessionless_activation_trial.js`
- `_tests/smoke_sessionless_live_authenticated_probe.js`
- `_tests/smoke_subscriptions_listen_isolated_validation.js`
- `_tests/smoke_subscriptions_listen_no_sse_project_contract.js`
- `_workflow/scripts/sessionless_live_authenticated_probe.js`

## Confirmed blockers to actual retirement

The following are still unresolved and block real route removal:

1. Final no-SSE notification replacement is still not defined.
   - current `/mcp/sessionless` `subscriptions/listen` uses request-scoped SSE
   - the replacement behavior on surviving `/mcp` does not yet exist

2. Replacement coverage on `/mcp` does not yet exist for the prototype-only path.
   - hidden-route `subscriptions/listen` has validation guards
   - equivalent surviving-route coverage is not yet present

3. Prototype-only state-handle surface is still evidence, not migrated truth.
   - hidden-route `state/handle/create`
   - hidden-route `state/handle/read`
   - hidden-route `state/handle/destroy`
   - this record does not decide whether those semantics move to `/mcp`, become tool-local, or are retired differently

4. Final initialize-retirement boundary is still unresolved.
   - `/mcp` still supports legacy `initialize`
   - additive `server/discover` is already present on `/mcp`
   - this record does not decide the final coexistence or removal boundary

## Retirement scope once blockers are cleared

When later authorized by replacement behavior and coverage, the bounded removal package must cover at least:

1. Runtime code
   - remove `/mcp/sessionless` dispatch from `src/runtime/create_server_route_dispatcher.js`
   - stop constructing the prototype route handler in runtime bootstrap
   - retire or relocate `src/runtime/sessionless_prototype_route_handler.js`

2. Runtime config/specs
   - remove `/mcp/sessionless` from `SERVER_RUNTIME_CONFIG_SPEC.json` route inventory
   - retire `MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE` from active runtime-config truth if no longer needed
   - reclassify prototype-specific fields from active runtime truth into historical evidence

3. Active smoke/test surface
   - archive or replace prototype-route guards that would no longer describe active runtime truth
   - preserve only those records/tests that remain useful as historical evidence or replacement-boundary checks

4. Workflow truth
   - keep route-selection truth on surviving `/mcp`
   - update inventories so `/mcp/sessionless` no longer appears as active runtime capability
   - keep historical records as evidence only

## Explicit non-decisions

This scoping record does not decide:

- the final no-SSE `subscriptions/listen` transport
- whether state-handle semantics survive as route methods, tool-local patterns, or separate helper tools
- the final `initialize` retirement boundary
- the final live removal sequence for tests versus runtime versus specs

Do not infer those decisions from this scoping record.

## Next safe workflow step

Prepare the final initialize-retirement boundary decision for the surviving `/mcp` route.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
