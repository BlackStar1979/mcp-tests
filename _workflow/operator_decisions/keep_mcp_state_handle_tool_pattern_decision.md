# Keep `/mcp` State-Handle Tool-Pattern Decision

Status: GREEN / FINAL FATE DECIDED / WORKFLOW-ONLY
Date: 2026-07-01

## Purpose

Decide the final fate of prototype-only `state/handle/*` semantics before hidden `/mcp/sessionless` retirement.

This record is bounded workflow truth only:

- no runtime code change
- no route removal
- no restart
- no connector refresh

## Source-backed decision basis

The current repo already records two binding facts:

1. Explicit state handles are part of the accepted target direction.
   - `_workflow/operator_decisions/post_stage6_operator_decisions_2026-06-21.md`
   - `_workflow/operator_decisions/p5_sessionless_explicit_state_handles_spec_review.md`

2. Explicit state handles are a tool-design pattern, not a protocol-level feature.
   - P5 records that explicit state handles are represented by IDs returned by tools and passed as ordinary tool arguments.
   - P5 also records that explicit state handles are not a new protocol construct or wire-level schema.

## Final fate decision

The hidden prototype route methods:

- `state/handle/create`
- `state/handle/read`
- `state/handle/destroy`

do not survive as end-state MCP route methods on `/mcp`.

Final target interpretation:

- explicit state handles remain allowed as an application/tool pattern;
- tool-created handles may still exist where state is unavoidable;
- those handles must be returned by tools and passed back as ordinary tool arguments;
- the end state does not keep route-level `state/handle/*` RPC methods as active protocol surface on surviving `/mcp`.

## Current repo truth after this decision

- hidden `/mcp/sessionless` still contains prototype-only `state/handle/*` code today;
- that code remains transition debt/evidence only;
- stable `/mcp` does not gain `state/handle/*` methods as the next step;
- future stateful workflows should migrate toward tool-local handle semantics, not a preserved route-level helper surface.

## Retirement consequence

Because the fate is now decided, hidden-route retirement is no longer blocked by uncertainty about whether `state/handle/*` must move onto surviving `/mcp`.

The next bounded package must:

1. retire hidden `/mcp/sessionless` runtime wiring from active code;
2. retire or reclassify prototype-only route-method documentation and tests;
3. keep only source-backed evidence that explicit state handles remain a tool-design pattern for future tool results/arguments, not an active `/mcp` RPC surface.

## Explicit non-decisions

This record does not:

- invent new tool names or tool schemas for future handle-bearing workflows;
- claim that current stable `/mcp` is already fully stateless;
- remove `src/runtime/state_handle_prototype.js` immediately;
- decide any durable persistence model for future handle-bearing tools.

## Next safe workflow step

Prepare the bounded hidden-route retirement package now that the `state/handle/*` fate is fixed.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
