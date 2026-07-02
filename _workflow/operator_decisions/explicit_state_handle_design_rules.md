# S3 Explicit State Handle Design Rules

Status: GREEN / PREPARED FOR S4 / NO RUNTIME CHANGE
Date: 2026-06-29

## Purpose

Prepare explicit state handle rules for a future S4 parallel draft/sessionless runtime prototype. The authoritative machine-readable source is `_workflow/sessionless_inventory.json#target_selection_readiness.s3_explicit_state_handle_design_rules`.

## Scope

S3 defines policy and guardrails only. It does not implement state handles, does not add tools, does not change transport behavior, and does not migrate the current OAuth21 connector.

## Rules recorded in inventory

- handles are opaque tool-design references, not protocol sessions;
- handle possession is not authorization;
- every handle use must revalidate OAuth subject/client/audience/profile/scope;
- handles must expire, revoke, and fail closed;
- raw handles must not appear in audit logs or human text;
- handle-bearing tools must use `state_handle` arguments and structuredContent results;
- S4 must run behind a non-default route or mode and keep current OAuth21 stable route unchanged.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit

## Non-actions

- no runtime state handle store
- no new handle-bearing tools
- no session code removal
- no POST-only draft mode
- no connector refresh
- no OAuth21 3008 restart
- no public 3009 start

## Validation

- `_tests/smoke_explicit_state_handle_design_rules.js`
- `_tests/smoke_sessionless_target_selection_readiness.js`
- `_tests/smoke_sep_sessionless_inventory.js`
- full `run_all --skip-network`

## Next recommendation

Proceed to S4 parallel draft/sessionless runtime prototype behind a non-default route or mode, while keeping the current OAuth21 3008 stable-compatible connector route unchanged.
