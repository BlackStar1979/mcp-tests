# Sessionless / Explicit State Handles Target Selection Decision

Status: GREEN / S2 TARGET SELECTED / NO RUNTIME CHANGE
Date: 2026-06-29

## Purpose

Record the missing S2 operator decision that was previously only prepared in the readiness packet.

This is a workflow-truth repair and decision-closeout step. It does not authorize new runtime work by itself, and it does not claim that S4-S15 were conceptually blocked after they were already validated in the repo.

This record is also historical in one important sense: it captures the then-selected parallel-track direction before the later active target correction to single-route, no-SSE, streamable HTTP on surviving `/mcp`. Read it as historical workflow evidence, not as the current destination contract.

## Decision

Selected target: `parallel_draft_sessionless_prototype_while_keeping_stable_connector_current`.

Meaning:

- keep the current OAuth21 `3008` stable-compatible `/mcp` route as the live connector target
- keep current session-oriented compatibility code in place for the stable route
- treat `/mcp/sessionless` as the then-current parallel draft/sessionless track
- continue validating sessionless behavior on the parallel route as historical transition evidence, not as the current destination contract
- do not perform a full switch now

## Rationale

This decision is consistent with:

- `_workflow/operator_decisions/post_stage6_operator_decisions_2026-06-21.md`
- `_workflow/operator_decisions/sessionless_target_selection_preparation.md`
- `_workflow/operator_decisions/sessionless_inventory_truth_consolidation.md`
- `_workflow/sessionless_inventory.json#target_selection_readiness`

It also matches subsequent repo reality:

- S3 explicit state-handle rules were prepared without runtime change
- S4 hidden `/mcp/sessionless` prototype was implemented in parallel
- S5 standardized that sessionless route for new workbench development only
- S8-S10B validated the hidden route on isolated and live OAuth21 paths
- S11-S15 preserved stable `/mcp` while validating coexistence and connector reconnect evidence

In other words, the repository already followed the parallel-track target; this record closes the missing workflow decision instead of introducing a new architectural branch.

## Non-actions

- no runtime code change
- no stable `/mcp` removal
- no session code removal
- no connector route migration
- no connector refresh
- no OAuth21 `3008` restart
- no public `3009` start
- no `subscriptions/listen` implementation
- no initialize/session-header removal from the stable compatibility route

## Decision consequences

Current consequences:

- S4-S15 remain valid as work performed under the selected parallel-track target
- `full_switch_now` remains `not_recommended`
- stable `/mcp` stays legacy-compatible until later client/migration evidence exists
- later historical sessionless work could continue against `/mcp/sessionless` and explicit state-handle rules, but that path has since been superseded by the current single-route target contract

Future work still requires separate bounded decisions:

- stateless-first `subscriptions/listen`
- migration away from stable session/header assumptions
- historical connector-route migration planning toward `/mcp/sessionless`
- eventual removal of stable session-oriented compatibility code

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
