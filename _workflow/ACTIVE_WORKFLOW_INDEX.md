# Active Workflow Index

Status: active navigation index
Date: 2026-07-02
Purpose: provide the current workflow entrypoint and separate active work from historical evidence. Do not create a separate master document.

## Current source of truth

Read these first, in this order:

1. `_workflow/ACTIVE_WORKFLOW_INDEX.md`
   - Navigation and active queue.
   - Separates current work from historical evidence.

2. `_workflow/state.json`
   - Machine-readable current package/status.
   - `current_work_constraints`.
   - `active_target_direction`.
   - `current_runtime_truth`.

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

## Current validated baseline

- Validated cleanup-closeout anchor on `main`: `aecec58`.
- Later workflow-only truth-sync commits may advance `main` without reopening the cleanup debt.
- Server version: `0.40.0`.
- Latest full smoke after historical-next-step quarantine guard: `ok_0_40_0_7_210`.
- Public section count: `7`.
- Authenticated smoke count: `210`.
- Cleanup-closeout checkpoint expected only `?? .codebase-memory/` and `?? _workflow/experiments/`; later local deviations require separate triage and do not retroactively reopen the cleanup closeout record.
- Earlier checkpointed hygiene closeout is complete.
- Repo hygiene audit is green.
- Earlier checkpoint-specific implementation approvals do not roll forward automatically; only explicitly named records govern their own scope.

Checkpoint topology:

- public runtime: `auth:none`, port `3009`, 13 tools;
- authorized runtime: `auth:oauth21`, port `3008`, 43 runtime tools;
- access/bearer runtime paths retired;
- public connector remains disconnected unless UI validation is explicitly needed;
- OAuth connector was refreshed and validated in the earlier authenticated reconnect checkpoint;
- Runtime drift ledger confirms current public local surface hash `0852d07b373a25ed`, matching the frozen public baseline; the older `f2830cb7817520ac` value is historical mismatch evidence, not current drift;
- Runtime compatibility labels are not workflow progress truth.

Recent committed checkpoints:

- Cleanup closeout head on `main`: `aecec58`.
- Cleanup truth/archive normalization record: `1b5ab42`.
- Cleanup runtime route/policy package: `44957ab`.

## Active operator decision records

Directory: `_workflow/operator_decisions/`

Current records:

- `post_stage6_operator_decisions_2026-06-21.md`
  - Binding D1-D12 operator direction after Stage 6.

- `p3_cancellation_path_client_disconnect_plan.md`
  - Plan-only cancellation path based on client disconnect / AbortSignal, with timeout fallback.

- `c3_cooperative_tool_cancellation.md`
  - Cooperative tool cancellation implementation. Removes stale earlier cancellation blockers, adds cooperative optional-tool cancellation, records no connector refresh, and is live-loaded on OAuth21 3008 with server_start_id 2026-06-28T18:29:15.549Z.

- `p4_runtime_policy_expansion_scope_plan.md`
  - Plan-only Resource/Scope Matrix Enforcement expansion.

- `p5_sessionless_explicit_state_handles_spec_review.md`
  - Official-source review of stable 2025-11-25 vs Final SEP-2567/2575 and draft sessionless direction.

- `sessionless_target_selection_preparation.md`
  - Sessionless / Explicit State Handles target-selection preparation. Recommends dual-track: keep current OAuth21 stable-compatible connector route unchanged and prepare a parallel draft/sessionless prototype behind a non-default route or mode. No runtime migration, connector refresh, or restart.

- `sessionless_target_selection_decision.md`
  - Missing S2 decision closeout. Selects the parallel draft/sessionless prototype while preserving stable `/mcp` as the live connector target. No runtime change, restart, or connector refresh.

- `no_sse_single_route_target_correction.md`
  - Corrects active target direction: SSE and dual-route coexistence are migration debt, not the intended destination. End-state target is single-route, streamable-HTTP-only, sessionless, and stateless.

- `single_route_no_sse_streamable_http_target_plan.md`
  - Active target contract and bounded migration plan. Historical S4-S15 sessionless records remain evidence only; they no longer define the intended destination.

- `single_route_selection_keep_mcp.md`
  - Final surviving route selection. `/mcp` remains the long-term route; `/mcp/sessionless` is transition-only debt and must not reappear as the target.

- `single_route_no_sse_migration_debt_inventory.md`
  - Confirmed debt inventory across runtime code, root specs, smoke coverage, and workflow interpretation. Use this as the removal map for the next implementation-scoping step.

- `keep_mcp_no_sse_replacement_package.md`
  - Confirms what must move onto `/mcp`, what must be removed from `/mcp`, and which no-SSE contract points are still unresolved and must not be guessed.

- `keep_mcp_post_accept_json_only_cleanup.md`
  - First repo-applied runtime package on the surviving `/mcp` route. Stable POST `/mcp` is now JSON-only; GET SSE teardown remains separate work.

- `keep_mcp_get_sse_teardown.md`
  - Second repo-applied runtime package on the surviving `/mcp` route. Stable GET `/mcp` no longer opens SSE and now returns `405`; request-contract migration remains separate work.

- `keep_mcp_request_contract_bridge.md`
  - Additive request-contract bridge on the surviving `/mcp` route. Stable `/mcp` now supports `server/discover` with per-request metadata validation while legacy `initialize` remains supported.

- `subscriptions_listen_compatibility_matrix.md`
  - Design-only compatibility matrix between stable `GET /mcp` SSE, future sessionless `subscriptions/listen`, and existing `tools/list_changed` dry-run work. No runtime change, restart, or connector refresh.

- `subscriptions_listen_isolated_validation.md`
  - First runtime validation of `subscriptions/listen` on an isolated higher-port sessionless server. Stable `/mcp`, OAuth21 `3008`, public `3009`, and connector target remain unchanged.

- `subscriptions_listen_no_sse_project_contract.md`
  - Source-bound clarification that official MCP still allows request-scoped SSE here, but TEST MCP deliberately chooses a stricter no-SSE destination. The current `/mcp/sessionless` listener remains transition-only evidence, not the target design.

- `sep2549_list_read_cache_inventory.md`
  - Mechanical inventory of current SEP-2549-style `ttlMs` / `cacheScope` coverage. Confirms active directives only on `tools/list`, no active top-level `resources/*` or `prompts/*` handlers, and no shared freshness layer yet for `tools/call` list/read-like payloads.

- `sessionless_prototype_route_retirement_scoping.md`
  - Bounded retirement scoping for hidden `/mcp/sessionless`. Confirms exact runtime/spec/test touchpoints and records blockers that still prevent real removal.

- `keep_mcp_initialize_retirement_boundary.md`
  - Final legacy boundary for `initialize` on surviving `/mcp`. It remains temporary compatibility only; new target-facing migration must attach to `server/discover` and per-request metadata instead.

- `keep_mcp_transport_session_retirement_package.md`
  - Repo-applied runtime package for surviving `/mcp`. Legacy `initialize` remains, but it no longer creates transport sessions, `Mcp-Session-Id` is no longer part of active stable-route behavior, and `server/discover` now reports `protocol_sessions: false`.

- `keep_mcp_sessionless_replacement_coverage_scoping.md`
  - Exact surviving-route replacement scope before hidden `/mcp/sessionless` removal. Records that no-SSE `subscriptions/listen`, `state/handle/*` fate, and bounded `/mcp` coverage must be settled first.

- `keep_mcp_subscriptions_listen_pull_only_contract.md`
  - Final no-SSE contract for tool-surface freshness on surviving `/mcp`. End-state freshness is pull-only via `tools/list`; no end-state `subscriptions/listen` or tool-list push promise remains.

- `keep_mcp_pull_only_tool_surface_freshness_runtime_package.md`
  - Repo-applied runtime package aligning active behavior to the pull-only contract. Stable `/mcp` no longer advertises `listChanged`; hidden `/mcp/sessionless` no longer implements `subscriptions/listen`.

- `keep_mcp_state_handle_tool_pattern_decision.md`
  - Final fate decision for prototype-only `state/handle/*`. Explicit state handles remain a tool-design pattern, but route-level `state/handle/*` methods do not survive on final `/mcp`.

- `keep_mcp_hidden_sessionless_route_retirement_package.md`
  - Repo-applied retirement package for hidden `/mcp/sessionless`. Active runtime code no longer wires the hidden route; live verification is recorded separately.

- `keep_mcp_hidden_sessionless_route_live_verification.md`
  - Controlled OAuth21 `3008` restart and bounded live verification. Hidden `/mcp/sessionless` now returns `404` live while stable `/mcp` still reports 43 tools.

- `sessionless_inventory_truth_consolidation.md`
  - Corrects target-selection preparation by removing duplicate source projection and making `_workflow/sessionless_inventory.json#target_selection_readiness` the single authoritative SEP/sessionless target source.

- `explicit_state_handle_design_rules.md`
  - Historical no-runtime preparation record for the hidden prototype route. Inventory remains authoritative for opaque handle model, authorization binding, lifecycle, audit redaction, and error-contract evidence. This record is not the active destination contract.

- `sessionless_runtime_prototype.md`
  - Historical parallel hidden-route prototype record. It documents how `/mcp/sessionless` was introduced behind `MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE`; it does not define the surviving route or current target.

- `workbench_sessionless_standardization.md`
  - Historical policy record from the period when isolated hidden-route tests were being standardized. Superseded as destination truth by the current single-route no-SSE target.

- `legacy_auth_cleanup_sessionless_ready_review.md`
  - Legacy retired-auth archive/cleanup and root `SERVER_*_SPEC.json` sessionless-ready review. Archives 17 retired access/bearer smoke files, adds consolidated negative controls, and keeps runtime/connector unchanged.

- `sessionless_sep2575_request_contract.md`
  - Historical runtime patch record for the hidden `/mcp/sessionless` contract. Useful as transition evidence only; it is not the active route contract.

- `isolated_sessionless_activation_regression.md`
  - Historical local higher-port activation/regression on port `3020` for the hidden route. Preserved as evidence only.

- `oauth21_sessionless_activation_trial.md`
  - Historical live hidden-route activation on OAuth21 `3008` after controlled supervisor restart. Preserved as evidence only; the route is no longer live now.

- `sessionless_live_authenticated_probe.md`
  - Historical repo-native live authenticated hidden-route probe on OAuth21 `3008`. Uses fresh in-process OAuth21 client/token flow, does not read durable OAuth state, and keeps connector/runtime unchanged.

- `connector_route_coexistence_boundary.md`
  - Historical readiness boundary after the authenticated hidden-route probe. `/mcp/sessionless` is transition-route evidence only, stable `/mcp` remains legacy-compatible, and any connector migration or refresh remains separate explicit work.

- `connector_migration_dry_run_plan.md`
  - Historical dry-run-only connector migration package. It defines rehearsal/evidence/rollback boundaries without connector refresh, route switch, `3008` restart, or `3009` start.

- `connector_migration_dry_run_harness.md`
  - Historical repo-native dry-run harness. It validates current `/mcp`, historical `/mcp/sessionless` transition-route evidence, unchanged connector-visible surface assumptions, rollback preservation, and sanitized output without refresh or migration.

- `connector_refresh_approval_package.md`
  - Historical operator/UI approval package. It treats remove + add in the Codex UI as the practical refresh-equivalent action, keeps the stable connector target on `/mcp`, and records that no connector execution had yet occurred at that point.

- `connector_reconnect_execution_evidence.md`
  - Historical operator/UI execution evidence for the stable `/mcp` connector. It records that remove + add was executed, the auth prompt appeared, the OAuth password was accepted, and Claude Code confirmed 43 visible tools.

- `state_and_snapshot_hygiene.md`
  - Repairs `state.json` back to an orientation map and removes recursive snapshot embedding from control-plane snapshots, with recurrence guards.

- `adjacent_runtime_contract_sep_triage.md`
  - Workflow-only triage of the 19 adjacent runtime-contract Final SEPs. It separates already-covered behavior, explicit non-targets, and a bounded partial-coverage watchlist.

- `auth_security_adjacent_sep_triage.md`
  - Workflow-only triage of the 7 auth/security-adjacent Final SEPs. It separates current auth coverage, explicit non-targets, and the remaining watchlist.

- `adjacent_sep_watchlist_review.md`
  - Review of the remaining adjacent/auth watchlist. Confirms that no new dedicated ledger should be opened now and records precise future triggers for reopening.

- `repo_hygiene_commit_scope_triage.md`
  - Repo hygiene triage after the validated workflow packages. Confirms that push is not safe yet and that commit-scope isolation is required first.

- `p6_event_driven_hotplug_lifecycle_design.md`
  - Design-only event-driven Hotplug lifecycle over existing list_changed dry-run stack.

- `event_driven_hotplug_lifecycle.md`
  - Event-driven Hotplug Lifecycle reconciliation. HPL1-HPL4 are reconciled; HPL5 remains gated behind a separate explicit operator runtime step. No live list_changed emission, tools/list mutation, state-store write, connector refresh, or restart.

- `stage13_live_repo_drift_ledger.md`
  - Historical drift ledger. Current public local surface matches the frozen baseline; runtime compatibility labels are not workflow truth.

- Runtime identity boundary guard
  - `_tests/smoke_runtime_identity_workflow_boundary.js` guards that `runtime_stage_status` remains a runtime compatibility label and must not be used as workflow progress truth.

- `stage13_crlf_hygiene_plan.md`
  - Stage 13.3 plan-only CRLF hygiene record. It records the existing .gitattributes policy and current CRLF population, and rejects global renormalization without a separate approved migration.

- `crlf_batch_normalization_lf_policy.md`
  - CRLF Batch Normalization and LF Policy. Normalizes tracked text files to LF, adds `.editorconfig`, changes `.gitattributes` to repo-wide LF including PowerShell, and adds a guard that rejects CRLF in tracked text.

- CRLF hygiene guard
  - `_tests/smoke_crlf_hygiene_plan.js` guards the plan-only boundary, .gitattributes declarations, state markers, and non-actions.

- `stage13_process_runner_ergonomics_note.md`
  - Stage 13.4 note-only process-runner ergonomics record. It captures bounded command practice, tool-layer block handling, output truncation handling, and alternate clean-tree probes without changing process-runner policy.

- Process-runner ergonomics guard
  - `_tests/smoke_process_runner_ergonomics_note.js` guards the note-only boundary, policy snapshot, state markers, and non-actions.

- `stage13_closeout.md`
  - Stage 13 closeout record. It closes Stage 13 after 13.1-13.4 and explicitly records that no Stage 14 implementation approval is carried forward.

- Closeout guard
  - `_tests/smoke_closeout.js` guards closed-state markers, final validation marker, later implementation-consent boundary, and non-actions.



- `stage14_runtime_enforcement_no_apply_package.md`
  - Stage 14.1 Runtime Enforcement Apply Package - No Apply. It records the future tools_call_handler hook, required future apply artifacts, and no-apply boundary.

- Stage 14.1 runtime enforcement no-apply guard
  - `_tests/smoke_runtime_enforcement_no_apply_package.js` guards the record, source/spec no-apply state, state markers, and absence of tools_call_handler wiring.

- `stage14_2_workbench_debt_cleanup.md`
  - Stage 14.2 developer workbench debt cleanup: blocker reassessment duty, restart/connector disclosure, control-plane-only backup path, post-Stage6 decisions, baselines, and scripts checks.

- Stage 14.2 workbench debt cleanup guard
  - `_tests/smoke_workbench_debt_cleanup.js` guards control-plane backup path, no root `_backups`, active validator paths, binding context, baselines, state markers, and no-apply boundary.

- `stage14_2b_repo_gremlin_double_scan.md`
  - Stage 14.2B double scan after workbench cleanup. It records two additional repo-wide scans, root-backup/control-plane cleanup, brittle workflow guard cleanup, remaining `_backups` reference classification, and no-apply boundary.

- Stage 14.2B repo gremlin double-scan guard
  - `_tests/smoke_repo_gremlin_double_scan.js` guards SERVER_SPEC legacy backup target, retired root `_backups`, internal truth/stress/control-plane checks, no brittle Stage14.2 current-work pins, state markers, and no-apply boundary.

- `stage14_3_runtime_enforcement_apply_design_review.md`
  - Stage 14.3 runtime enforcement apply design review, still no apply. It reassesses blockers, restart/connector/baseline/control-plane implications, future denial/audit contracts, validation plan, and recommends Stage 14.4 apply package draft still no apply.

- Stage 14.3 apply design review guard
  - `_tests/smoke_runtime_enforcement_apply_design_review.js` guards no-apply boundary, disabled runtime enforcement specs, no tools_call_handler wiring, blocker reassessment, future restart/connector/baseline decisions, and manifest inclusion.

- `stage14_4_runtime_enforcement_apply_package_draft.md`
  - Stage 14.4 runtime enforcement apply package draft, still no apply. It adds code-backed draft data for future diff envelope, approval marker template, tests, denial/audit contracts, and restart/connector/baseline/control-plane decisions.

- Stage 14.4 apply package draft guard
  - `_tests/smoke_runtime_enforcement_apply_package_draft.js` guards draft-only mode, no runtime enforcement, no tools_call_handler wiring, approval template not recorded, and conditional future restart/connector/baseline decisions.


- `stage14_7_tools_list_cache_diagnostics_plan.md`
  - Stage 14.7 / Sprint D1 tools/list cache diagnostics plan. It records SEP-2549 ttlMs/cacheScope direction, fingerprint/serverStartId diagnostics, audit/test requirements, no-fake-listChanged guardrails, explicit separation from OAuth durability, live TESTS_MCP 3008 validation, and manual connector refresh observation. Status: D1-A/D1-B/D1-C repo-applied/live-validated; connector-visible map is in sync 43/43; manual connector refresh produced tools/list and cache directive for the active server start.

- `stage14_8_runtime_enforcement_state_reconciliation.md`
  - Stage 14.8 runtime enforcement state reconciliation. It records repo-applied Stage 14.5 runtime gate, OAuth21 3008 live-loaded status after later restart, public 3009 currently not listening, unchanged connector surface, and no restart/refresh boundary.

- `stage14_9_workflow_truth_repair.md`
  - Stage 14.9 workflow truth repair / state compaction. It records the operator rule that every next-step recommendation must reassess blocker validity, connector refresh, and workbench restart; it also records that the assistant can restart the workbench when workflow and operator intent authorize it.

## Active remaining work queue

Current active queue is maintained in `_workflow/WORKFLOW_CANON.md` and this index. `_workflow/state.json` is only the compact machine-readable orientation map.

1. Prepare the bounded cleanup package for residual session/SSE runtime debt that is no longer reachable from active `/mcp`.

Historical records remain traceability evidence, not the active queue.
`_workflow/control_plane/snapshots/**` is archival evidence only and must not be used as the active interpretation layer for route/transport truth.

Next recommended action: use `_workflow/operator_decisions/keep_mcp_transport_session_retirement_package.md` together with `_workflow/operator_decisions/single_route_no_sse_migration_debt_inventory.md` to isolate the now-unreachable session/SSE helpers that can be removed or downgraded without reopening historical `/mcp/sessionless` planning as if it were current target architecture.

Recently completed:

- Applied the bounded surviving-route transport-session retirement package: stable `/mcp` no longer creates transport sessions, no longer emits `Mcp-Session-Id`, ignores session headers on POST, and now reports `protocol_sessions: false` from `server/discover`.

- Verified cleanup/normalization closeout on `main`: cleanup anchor `aecec58` remains in `main` history, `node server.js --self-test` is green, and `node _tests/run_all_smokes.js --skip-network` is green with `7` public and `210` authenticated scripts.

- Added `_tests/smoke_historical_next_recommendation_quarantine.js` and rewrote lingering historical `Next recommendation` leakage so completed side records no longer masquerade as the active queue.

- Confirmed the previous dirty-worktree push blocker is closed on `main`; the cleanup-closeout checkpoint preserved only local-only untracked directories `.codebase-memory/` and `_workflow/experiments/` outside the committed repo surface.

- Added explicit archive-boundary README files for `_workflow/historical/`, `_tests/archive/`, and `_tests/archive/legacy_retired_auth/`, then extended `smoke_state_and_snapshot_hygiene.js` so archived evidence is less likely to be mistaken for active workflow truth.

- Added an archival-quarantine README for `_workflow/control_plane/retired_root_backups/` and extended `smoke_state_and_snapshot_hygiene.js` so legacy moved root backups are not misread as active route/test/workflow authority.

- Reviewed the adjacent/auth watchlist and intentionally avoided opening speculative new ledgers; recorded future trigger conditions instead.

- Triaged the 19 adjacent runtime-contract Final SEPs into covered, explicit non-target/disabled, and partial-watchlist buckets.

- Triaged the 7 auth/security-adjacent Final SEPs into covered, explicit non-target, and partial-watchlist buckets.

- Quarantined historical `/mcp/sessionless` live-operation artifacts so they no longer read like the active target architecture.

- Bounded hidden-route retirement package after the `state/handle/*` fate was fixed.

- Controlled OAuth21 `3008` restart and bounded live verification for the hidden-route retirement package.

- Final `state/handle/*` fate decision: explicit state handles remain a tool-design pattern, but route-level `state/handle/*` methods are not part of the surviving `/mcp` end state.

- Bounded runtime package to retire prototype-only `subscriptions/listen` / push debt and align `/mcp` freshness to the pull-only contract.

- Implementation scoping for replacement behavior and coverage required before `/mcp/sessionless` removal.

- Final initialize-retirement boundary decision for the surviving `/mcp` route.

- Teardown package for `GET /mcp` SSE, `Last-Event-ID`, and stable stream-path replay semantics.

- `post_stage13_repo_hygiene_audit.md`
  - Repo hygiene audit record. It verifies code health, cleans the active workflow queue, and records the six remaining work items before any later implementation proposal.

- Repo hygiene guard
  - `_tests/smoke_repo_hygiene_audit.js` guards the audit record, active queue, state markers, and no-implementation boundary.

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

Stage 14.5 runtime enforcement apply correction: commit d299cfa is repo-applied. Public 3009 auth:none was restarted/replaced as pid=22804 and validated by health/tools-list. OAuth21 3008 was not restarted; TESTS_MCP runtime status observes 3008 read-only, not the restarted 3009 process. OAuth21 3008 Stage14.5 restart requirement is superseded by Stage 14.8/14.9 evidence and current supervisor authority. Connector refresh not required; baseline refreeze not required.

Stage 14.6 inventory repair: sessionless_inventory now tracks SEP-2549/2567/2575/2577/2596 with checklist evidence. Guard: smoke_sep_sessionless_inventory.
