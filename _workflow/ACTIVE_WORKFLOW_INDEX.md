# Active Workflow Index

Status: active navigation index
Date: 2026-06-24
Purpose: provide the current workflow entrypoint and separate active work from historical evidence. Do not create a separate master document.

## Current source of truth

Read these first, in this order:

1. `_workflow/ACTIVE_WORKFLOW_INDEX.md`
   - Navigation and active queue.
   - Separates current work from historical evidence.

2. `_workflow/state.json`
   - Machine-readable current package/status.
   - `next_allowed_work`.
   - `post_stage13_hygiene.active_remaining_work`.

3. `_workflow/WORKFLOW_CANON.md`
   - Chronological canon and final decision ledger.
   - Current-state summary is near the top; older sections remain history unless repeated in current state.

4. Root specs:
   - `SERVER_SPEC.json`
   - `SERVER_AUTH_SPEC.json`
   - `SERVER_CONNECTOR_SURFACE_SPEC.json`
   - `SERVER_PROFILES_SPEC.json`
   - `SERVER_TOOLS_SPEC.json`
   - `SERVER_POLICY_RUNTIME_SPEC.json`
   - `SERVER_RESOURCE_POLICY_SPEC.json`
   - category policy specs as referenced by root specs.

5. Current run-all manifest:
   - `_tests/run_all_smoke_scripts.json`

Do not infer active work from historical plan files unless `_workflow/state.json` or this index names it as active.

## Current GREEN baseline

Post-Stage 13 baseline:

- HEAD after post-Stage 13 hygiene audit: `0932dd0`.
- Server version: `0.40.0`.
- Latest full smoke after Stage 14.7 live-validation guard: `ok_0_40_0_6_183`.
- Public section count: `6`.
- Authenticated smoke count: `183`.
- Stage 13: closed.
- Post-Stage 13 repo hygiene audit: green.
- Stage 14 implementation approval: false.

Checkpoint topology:

- public runtime: `auth:none`, port `3009`, 13 tools;
- authorized runtime: `auth:oauth21`, port `3008`, 43 runtime tools;
- access/bearer runtime paths retired;
- public connector remains disconnected unless UI validation is explicitly needed;
- OAuth connector was refreshed and validated in Stage 6;
- Stage 13.1 ledger confirms current public local surface hash `0852d07b373a25ed`, matching the frozen public baseline; post-Stage 12 `f2830cb7817520ac` is historical measurement mismatch, not current runtime drift;
- Stage 13.2 boundary confirms the runtime-stage label is a runtime compatibility label, not workflow progress truth.

Recent committed stages:

- Stage 13 closeout: `c368433`.
- Post-Stage 13 repo hygiene audit: `0932dd0`.

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

- `stage13_live_repo_drift_ledger.md`
  - Stage 13.1 read-only repo/runtime drift ledger. Current public local surface matches frozen baseline; runtime-stage label debt was closed by the Stage 13.2 boundary guard.

- Stage 13.2 boundary guard
  - `_tests/smoke_stage13_runtime_identity_workflow_boundary.js` guards that `runtime_stage_status` remains a runtime compatibility label and must not be used as workflow progress truth.

- `stage13_crlf_hygiene_plan.md`
  - Stage 13.3 plan-only CRLF hygiene record. It records the existing .gitattributes policy and current CRLF population, and rejects global renormalization without a separate approved migration.

- Stage 13.3 CRLF hygiene guard
  - `_tests/smoke_stage13_crlf_hygiene_plan.js` guards the plan-only boundary, .gitattributes declarations, state markers, and non-actions.

- `stage13_process_runner_ergonomics_note.md`
  - Stage 13.4 note-only process-runner ergonomics record. It captures bounded command practice, tool-layer block handling, output truncation handling, and alternate clean-tree probes without changing process-runner policy.

- Stage 13.4 process-runner ergonomics guard
  - `_tests/smoke_stage13_process_runner_ergonomics_note.js` guards the note-only boundary, policy snapshot, state markers, and non-actions.

- `stage13_closeout.md`
  - Stage 13 closeout record. It closes Stage 13 after 13.1-13.4 and explicitly records that no Stage 14 implementation approval is carried forward.

- Stage 13 closeout guard
  - `_tests/smoke_stage13_closeout.js` guards closed-state markers, final validation marker, Stage 14 consent boundary, and non-actions.



- `stage14_runtime_enforcement_no_apply_package.md`
  - Stage 14.1 Runtime Enforcement Apply Package - No Apply. It records the future tools_call_handler hook, required future apply artifacts, and no-apply boundary.

- Stage 14.1 runtime enforcement no-apply guard
  - `_tests/smoke_stage14_runtime_enforcement_no_apply_package.js` guards the record, source/spec no-apply state, state markers, and absence of tools_call_handler wiring.

- `stage14_2_workbench_debt_cleanup.md`
  - Stage 14.2 developer workbench debt cleanup: blocker reassessment duty, restart/connector disclosure, control-plane-only backup path, post-Stage6 decisions, baselines, and scripts checks.

- Stage 14.2 workbench debt cleanup guard
  - `_tests/smoke_stage14_2_workbench_debt_cleanup.js` guards control-plane backup path, no root `_backups`, active validator paths, binding context, baselines, state markers, and no-apply boundary.

- `stage14_2b_repo_gremlin_double_scan.md`
  - Stage 14.2B double scan after workbench cleanup. It records two additional repo-wide scans, root-backup/control-plane cleanup, brittle workflow guard cleanup, remaining `_backups` reference classification, and no-apply boundary.

- Stage 14.2B repo gremlin double-scan guard
  - `_tests/smoke_stage14_2b_repo_gremlin_double_scan.js` guards SERVER_SPEC legacy backup target, retired root `_backups`, internal truth/stress/control-plane checks, no brittle Stage14.2 current-work pins, state markers, and no-apply boundary.

- `stage14_3_runtime_enforcement_apply_design_review.md`
  - Stage 14.3 runtime enforcement apply design review, still no apply. It reassesses blockers, restart/connector/baseline/control-plane implications, future denial/audit contracts, validation plan, and recommends Stage 14.4 apply package draft still no apply.

- Stage 14.3 apply design review guard
  - `_tests/smoke_stage14_3_runtime_enforcement_apply_design_review.js` guards no-apply boundary, disabled runtime enforcement specs, no tools_call_handler wiring, blocker reassessment, future restart/connector/baseline decisions, and manifest inclusion.

- `stage14_4_runtime_enforcement_apply_package_draft.md`
  - Stage 14.4 runtime enforcement apply package draft, still no apply. It adds code-backed draft data for future diff envelope, approval marker template, tests, denial/audit contracts, and restart/connector/baseline/control-plane decisions.

- Stage 14.4 apply package draft guard
  - `_tests/smoke_stage14_4_runtime_enforcement_apply_package_draft.js` guards draft-only mode, no runtime enforcement, no tools_call_handler wiring, approval template not recorded, and conditional future restart/connector/baseline decisions.


- `stage14_7_tools_list_cache_diagnostics_plan.md`
  - Stage 14.7 / Sprint D1 tools/list cache diagnostics plan. It records SEP-2549 ttlMs/cacheScope direction, fingerprint/serverStartId diagnostics, audit/test requirements, no-fake-listChanged guardrails, explicit separation from OAuth durability, live TESTS_MCP 3008 validation, and manual connector refresh observation. Status: D1-A/D1-B/D1-C repo-applied/live-validated; connector-visible map is in sync 43/43; manual connector refresh produced tools/list and cache directive for the active server start.

- `stage14_8_runtime_enforcement_state_reconciliation.md`
  - Stage 14.8 runtime enforcement state reconciliation. It records repo-applied Stage 14.5 runtime gate, OAuth21 3008 live-loaded status after later restart, public 3009 currently not listening, unchanged connector surface, and no restart/refresh boundary.

## Active remaining work queue

Current active queue is maintained in `_workflow/state.json` under `post_stage13_hygiene.active_remaining_work` and summarized in `_workflow/operator_decisions/post_stage13_repo_hygiene_audit.md`.

1. Runtime Enforcement state reconciliation - Stage 14.8 green; repo-applied runtime gate is live-loaded on OAuth21 3008, public 3009 is not currently live, and no restart/connector refresh was performed.
2. Cooperative Tool Cancellation C3.
3. Event-driven Hotplug Lifecycle.
4. Sessionless / Explicit State Handles Target Selection.
5. Legacy Retired Auth Test Archive/Cleanup.
6. CRLF Batch Normalization.
7. Tools/list cache diagnostics D1: D1-A/D1-B/D1-C repo-applied and live-validated on TESTS_MCP 3008. Connector-visible map is in sync 43/43; manual connector refresh produced tools/list and cache directive for the active server start.

Closed historical stages and historical plans below are retained for traceability, not active next-work lists.

- `post_stage13_repo_hygiene_audit.md`
  - Post-Stage 13 audit record. It verifies code health, cleans the active workflow queue, and records the six remaining work items before any Stage 14 proposal.

- Post-Stage 13 repo hygiene guard
  - `_tests/smoke_post_stage13_repo_hygiene_audit.js` guards the audit record, active queue, state markers, and no-implementation boundary.

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

Stage 14.5 runtime enforcement apply correction: commit d299cfa is repo-applied. Public 3009 auth:none was restarted/replaced as pid=22804 and validated by health/tools-list. OAuth21 3008 was not restarted; TESTS_MCP runtime status observes 3008 read-only, not the restarted 3009 process. OAuth21 3008 still requires an OAuth-aware restart to load Stage14.5 runtime code. Connector refresh not required; baseline refreeze not required.

Stage 14.6 inventory repair: sessionless_inventory now tracks SEP-2549/2567/2575/2577/2596 with checklist evidence. Guard: smoke_stage14_6_sep_sessionless_inventory.
