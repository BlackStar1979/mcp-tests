# Active Workflow Index

Status: active compact index
Date: 2026-06-21
Purpose: reduce workflow navigation noise without moving or deleting historical records.

## Current source of truth

Read these first:

1. `_workflow/state.json`
   - Current package/status.
   - Next allowed work.
   - Recent validation summaries.

2. `_workflow/WORKFLOW_CANON.md`
   - Chronological canon and final decision ledger.
   - Use as the authoritative workflow narrative.

3. Root specs:
   - `SERVER_SPEC.json`
   - `SERVER_AUTH_SPEC.json`
   - `SERVER_CONNECTOR_SURFACE_SPEC.json`
   - `SERVER_PROFILES_SPEC.json`
   - `SERVER_TOOLS_SPEC.json`
   - `SERVER_POLICY_RUNTIME_SPEC.json`
   - `SERVER_RESOURCE_POLICY_SPEC.json`
   - category policy specs as referenced by root specs.

4. Current run-all manifest:
   - `_tests/run_all_smoke_scripts.json`

## Current GREEN baseline

Stage 8 closeout:

- static registry foundation committed at `2385a03`;
- registry-to-policy read model committed at `d538320`;
- registry diff dry-run committed at `1f552ca`;
- no hotplug/list_changed emission/runtime policy enforcement enabled.


Checkpoint topology:

- public runtime: `auth:none`, port `3009`, 13 tools;
- authorized runtime: `auth:oauth21`, port `3008`, 43 runtime tools;
- access/bearer runtime paths retired;
- public connector remains disconnected unless UI validation is explicitly needed;
- OAuth connector was refreshed and validated in Stage 6.

Recent committed stages:

- Stage 1-6 checkpoint: `2c54b8cfb36767d021699f1d1a2b1198e0f525a0`
- P1 batch SSE unsupported guard: `a125fd2641fdb57067ef11e0dfd0181fe38d9416`
- P2 legacy auth triage: `44aeb8f`
- P3 cancellation plan: `61a03b9`
- P4 runtime policy expansion plan: `d123dc1`
- P5 sessionless spec review: `f0b7d7c`
- P6 hotplug design: `550ace4`

## Active operator decision records

Directory: `_workflow/operator_decisions/`

Current records:

- `post_stage6_operator_decisions_2026-06-21.md`
  - Binding D1-D12 operator direction after Stage 6.

- `p3_cancellation_path_client_disconnect_plan.md`
  - Plan-only cancellation path based on client disconnect / AbortSignal, with timeout fallback.

- `p4_runtime_policy_expansion_scope_plan.md`
  - Plan-only Resource/Scope Matrix Enforcement expansion.

- `p5_sessionless_explicit_state_handles_spec_review.md`
  - Official-source review of stable 2025-11-25 vs Final SEP-2567/2575 and draft sessionless direction.

- `p6_event_driven_hotplug_lifecycle_design.md`
  - Design-only event-driven Hotplug lifecycle over existing list_changed dry-run stack.

## Historical workflow plans retained in place

These are historical but still useful. Do not read them as current truth without checking `WORKFLOW_CANON.md` and `state.json`.

- `_workflow/STREAMABLE_HTTP_SAMPLING_OAUTH_WORKFLOW.md`
  - Historical Phase A-G workflow plus later corrections.
  - Some entries are retained for chronology.

- `_workflow/OAUTH_PRODUCTION_HARDENING_PLAN.md`
  - Historical H1-H10 OAuth hardening plan.
  - Later notes record that prior debts were closed or superseded.

- `_workflow/CONNECTOR_REFRESH_READINESS.md`
  - H9 readiness and Stage 6 connector evidence.
  - Further refresh remains operator-gated.

## Control plane and scripts

- `_workflow/control_plane/`
  - Snapshots, deploy records, backup/rollback records.
  - Do not delete without a retention decision.

- `_workflow/scripts/`
  - Validators, workflow utilities, control-plane helpers.
  - These are active support scripts where referenced by tests.

- `_workflow/baselines/`
  - Frozen baselines.

- `_workflow/_diagnostics/`
  - Diagnostic evidence.

## Legacy/auth archive

- `_tests/legacy_retired_auth_smoke_manifest.json`
  - 17 retired access/bearer legacy tests classified as:
    - 9 rewrite_as_negative_control;
    - 6 archive_only;
    - 2 delete_after_review.

No legacy retired auth test is active in run_all.

## Reading order for next agent

1. `_workflow/state.json`
2. `_workflow/ACTIVE_WORKFLOW_INDEX.md`
3. `_workflow/operator_decisions/post_stage6_operator_decisions_2026-06-21.md`
4. The current task-specific operator decision record, if any.
5. Root specs.
6. Only then historical plans.

## Non-destructive compaction policy

This index is intentionally non-destructive. It does not move historical workflow files because:

- tests reference existing paths;
- grep/audit history is still useful;
- moving old records would create avoidable diff churn.

Future archive compaction may move files only after a dedicated migration plan updates tests and references.
