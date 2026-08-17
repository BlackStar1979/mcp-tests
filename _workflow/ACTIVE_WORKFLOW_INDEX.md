# Active Workflow Index

Status: active navigation index
Date: 2026-08-17
Purpose: provide the current workflow entrypoint and separate active work from historical evidence. Do not create a separate master document.

Current repo/runtime note: profile `tests`; live OAuth21 `3008` has source commit `555fad0` loaded by controlled restart `manual-1786988583476` at `server_start_id = 2026-08-17T17:43:05.322Z`. The runtime exposes `98` connector-visible tools with fingerprint `ec7d3af5b4ea17f5`; `/healthz`, post-restart connector calls, and durable process recovery are green. `MCP-TASKS-PROCESS-ADAPTER` (`7 + 294`), `TRACE-CONTEXT` (`7 + 298`), `PROCESS-ARTIFACTS` (`7 + 301`), `CIMD` (`7 + 304`), and `DEBT-1-RETIREMENT` (`7 + 305`) are live-loaded and live-accepted. `MRTR` remains fixture-only conformance evidence at `7 + 305`; runtime loading is not applicable because it has no production runtime surface.

`DEBT-1-RETIREMENT` is live-loaded. Controlled restart `manual-1786939596474` loaded the cleanup at `server_start_id = 2026-08-17T04:06:37.912Z`; post-restart `workbench.get_info` succeeded, and the tool count plus all governed surface fingerprints remained unchanged. No connector refresh or OAuth reauthorization was required.

`OBS-1-LIVE-TRAIL` is accepted at `4/4`: current and retained audit windows answer the active client-entry question without broader logging. All named-option local JavaScript CLI entrypoints now converge on the shared fail-closed parser, including explicit repeatable options for snapshot files, CBM projects, and ignored trace IDs; malformed arguments cannot silently alter scope, select implicit defaults, or reach mutation behavior. Relative marker-patch and runtime-log compaction paths are repository-root anchored independently of caller cwd, with explicit absolute paths preserved.

Read-only control-plane root fidelity is closed: shared root-spec loading plus active fixture validators, decision evaluators, negative controls, decision-runtime contract validators, and index-authority reporting derive repository scope from their script location. Aggregate foreign-cwd coverage and all seven dedicated smoke paths are green.

The obsolete public-sandbox source-copy mutator is retired from the active control plane. Its stale manifest-bound smoke remains archived as provenance, while a current regression prevents restoration of the ignored duplicate-source path.

Deploy-decision runtime-boundary fidelity is closed: guard v2 recognizes all known startup-loaded source/config roots across relative, absolute, and Windows-style paths, while keeping documentation/tests repo-only and connector refresh separately flag-driven. The corrected classification is live-accepted after controlled restart `manual-1786980050739` with no OAuth reauthorization or tool-surface drift.

Snapshot and full-harness root fidelity are closed: snapshot creation is caller-cwd independent, stages files and manifest under a unique `.pending-*` directory, retries transient Windows rename locks without abandoning same-volume atomic publication, and rolls staging back on terminal failure. `run_all_smokes.js` anchors repository resources and relative manifests to its script location, parses options fail-closed, awaits child-server exit, and removes per-run storage in `finally`; its no-pollution guard executes the inner full suite from a foreign cwd and verifies unchanged audit, snapshot, and temp-store sets. One-time cleanup removed `684` snapshot artifacts while preserving `17` named snapshots, then removed `298` stale run stores (`72,496,903` bytes) while conservatively retaining `13` PID-occupied directories. No runtime restart or connector refresh is required.

The operator refreshed OAuth authorization and the connector tool list before the final controlled load. The connector entered through `server/discover` on MCP `2026-07-28`, returned all `98` tools, survived the subsequent supervisor restart with OAuth state intact, and remains callable.
Current workflow markers:
- The project-local CBM skill routes documentation/workflow questions to the dependency-free knowledge index.
- `current_working_course = policy-coverage-critical-gap-closure`
- `next_primary = pol-1a-output-dlp-boundary`
- `next_secondary = pol-1a-consent-boundary`
- `Stage 8 / Step 53b` = modular safe tool surface consolidation
- `Stage 8 / Step 53c` = modular unsafe tool governance boundary
- `Stage 8 / Step 53d` = live restart and connector surface reconciliation

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

5. Current migration inventory for sibling modular server consolidation:
   - `_workflow/inventories/modular_tool_migration_inventory.json`
   - `_workflow/inventories/modular_tool_migration_inventory.md`
   - Generated from `C:\Work\mcp` and normalized to current `public` vs `tests` target surfaces.

6. Current run-all manifest:
   - `_tests/run_all_smoke_scripts.json`

7. Project-local agent skills:
   - `.agents/skills/using-codebase-memory/SKILL.md`
   - Load `references/tools.md` for exact `cbm_*` contracts and `references/scenarios.md` for decision examples only when their `Load when:` condition matches the task.

8. Operator-facing documentation contract:
   - `_workflow/NORTHSTAR.md`
   - `_workflow/STATE.md`
   - `_workflow/READINESS.md`
   - `_workflow/ROADMAP.md`
   - `DIRECTORY.md`
   - `READINESS.md` is the component-readiness bridge used to infer the next autonomous package when `ROADMAP.md` alone is too coarse.
   - `ROADMAP.md` must read as a downstream execution order derived from `READINESS.md`, not as an independent wish list.
   - A fresh `index_status` is the single-call planning view: it exposes next-package markers, maturity/blocker/default-package rows, ordered roadmap actions, runtime identity, canonical health, and documentation gaps without manual cross-reading.

Do not infer active work from historical plan files unless `_workflow/state.json` or this index names it as active.

## Current validated baseline

- Validated cleanup-closeout anchor on `main`: `aecec58`.
- Later workflow-only truth-sync commits may advance `main` without reopening the cleanup debt.
- Server version: `0.40.0`.
- Latest full smoke: `ok=true, version=0.40.0, public=7, tests_authenticated=308`.
- Public section count: `7`.
- Authenticated smoke count: `308`.
- Cleanup-closeout checkpoint expected only `?? .codebase-memory/` and `?? _workflow/experiments/`; later local deviations require separate triage and do not retroactively reopen the cleanup closeout record.
- Earlier checkpointed hygiene closeout is complete.
- Repo hygiene audit is green.
- Earlier checkpoint-specific implementation approvals do not roll forward automatically; only explicitly named records govern their own scope.
- The bounded `/mcp` response-side observability package is now live-loaded on OAuth21 `3008`; bounded live probes confirm `rpc_response_sent` on active `method_not_allowed`, `auth_rejected`, and authenticated local `initialize` paths, with server_start_id `2026-07-12T14:48:47.370Z`.

Checkpoint topology:

- public runtime: `auth:none`, port `3009`, 13 tools;
- authorized runtime: `auth:oauth21`, port `3008`, repository and live runtime `98` at `server_start_id = 2026-08-13T18:45:01.480Z`;
- access/bearer runtime paths retired;
- public connector remains disconnected unless UI validation is explicitly needed;
- OAuth connector was refreshed and validated in the earlier authenticated reconnect checkpoint;
- Repository, live runtime, and this model map are aligned at `98`. The hardened CBM v0.9.0, canonical PKCE, activated memory, freshness-aware retrieval, durable task lifecycle, structured file subsystem, and final dual-era protocol contracts remain unchanged.
- Runtime drift ledger confirms current public local surface hash `0852d07b373a25ed`, matching the frozen public baseline; the older `f2830cb7817520ac` value is historical mismatch evidence, not current drift;
- Runtime compatibility labels are not workflow progress truth.
- Operator-facing documentation contract (`DOC-1`) is accepted at `4/4` through a freshness-gated one-call planning view and live query-quality evidence. `DOC-2` is accepted at `4/4`: all `68/68` directories containing tracked files have functional maps. Generator `--help`/`--check` are non-mutating, invalid arguments fail before writes, dynamic control-plane maps have one generation authority, and repo-wide coverage is guarded.

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
  - Historical baseline plan for the cancellation path based on client disconnect / AbortSignal, with timeout fallback.

- `c3_cooperative_tool_cancellation.md`
  - Cooperative tool cancellation implementation. Removes stale earlier cancellation blockers, adds cooperative optional-tool cancellation, records no connector refresh, and is live-loaded on OAuth21 3008 with server_start_id 2026-06-28T18:29:15.549Z.

- `request_cancellation_closeout.md`
  - Workflow closeout for the bounded stable-compatible cancellation package. Confirms C1-C4 are already satisfied in repo truth: abort-signal plumbing, no-write-after-disconnect guard, cooperative optional-tool cancellation, and preserved timeout fallback.

- `mcp_session_id_header_closeout.md`
  - Workflow closeout for the active stable-route `MCP-Session-Id` header dependency. Confirms initialize no longer emits the header, POST ignores supplied session headers, and `server/discover` reports `protocol_sessions: false`.

- `session_store_closeout.md`
  - Workflow closeout for the `SessionStore` migration boundary. Confirms active `/mcp` no longer depends on transport-session lifecycle, `session_store.js` is gone from the active repo, and the remaining helper modules are bounded local compatibility debt.

- `roots_sampling_logging_deprecation_closeout.md`
  - Workflow closeout for the deprecated roots/sampling/logging bucket. Confirms active `/mcp` no longer injects sampling, no active roots surface is pending, and remaining sampling/audit code is no longer an open migration blocker.

- `restart_resilience_closeout.md`
  - Workflow closeout for the runtime topology / restart boundary. Confirms OAuth21 `3008` restart authority is recovered, machine-readable, supervisor-managed, and no longer an open blocker in workflow truth.

- `p4_runtime_policy_expansion_scope_plan.md`
  - Historical planning baseline for Resource/Scope Matrix Enforcement expansion.

- `runtime_policy_scope_matrix_closeout.md`
  - Workflow closeout for the bounded runtime policy gate already active in repo/live truth. Confirms Stage 14.5 gate is wired in `tools/call`, Stage 14.8 reconciles OAuth21 3008 live-load, and no connector refresh is required.

- `feature_lifecycle_deprecation_policy_closeout.md`
  - Workflow closeout for SEP lifecycle governance at the inventory layer. Confirms lifecycle/status/migration/checklist structure and smoke coverage are already active in `_workflow/sessionless_inventory.json`.

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

- `initialize_no_handshake_repo_evidence.md`
  - Repo-side evidence record for `initialize` retirement scoping. Confirms the surviving `/mcp` route already supports `server/discover` and useful `tools/list` / `tools/call` flow without a preceding `initialize`; the remaining blocker is external client/connector compatibility evidence.

- `initialize_client_compatibility_evidence.md`
  - Real client compatibility evidence for `initialize` retirement scoping. Confirms a freshly re-added Codex desktop Streamable HTTP connector can complete OAuth and still call legacy `initialize`, so bounded single-route dual recognition remains temporary compatibility debt rather than destination architecture.

- `connector_runtime_callable_surface_revalidation.md`
  - Fresh model-runtime evidence that authenticated `workbench` tools are callable again from this Codex runtime session, while keeping full UI visible-tool enumeration as a separate unclaimed layer.

- `initialize_retirement_decision_prep.md`
  - Bounded decision-prep package for eventual `initialize` retirement. Confirms the remaining blocker is current real client entry behavior plus later explicit authorization, not missing repo/runtime no-handshake support.

- `subscriptions_listen_compatibility_matrix.md`
  - Design-only compatibility matrix between stable `GET /mcp` SSE, future sessionless `subscriptions/listen`, and existing `tools/list_changed` dry-run work. No runtime change, restart, or connector refresh.

- `subscriptions_listen_isolated_validation.md`
  - First runtime validation of `subscriptions/listen` on an isolated higher-port sessionless server. Stable `/mcp`, OAuth21 `3008`, public `3009`, and connector target remain unchanged.

- `subscriptions_listen_no_sse_project_contract.md`
  - Source-bound clarification that official MCP still allows request-scoped SSE here, but TEST MCP deliberately chooses a stricter no-SSE destination. The current `/mcp/sessionless` listener remains transition-only evidence, not the target design.

- `sep2549_list_read_cache_inventory.md`
  - Mechanical baseline inventory for SEP-2549-style `ttlMs` / `cacheScope` coverage before the bounded `tools/call` runtime package. Confirms that top-level `resources/list`, `resources/templates/list`, and `prompts/list` are compatibility-only empty-list handlers rather than an active repo resource/prompt surface.

- `list_results_ttl_cache_scope_runtime_package.md`
  - Repo-applied bounded runtime package for active `tools/call` results. Shared `ttlMs: 0` / `cacheScope: "private"` now apply only to `SERVER_TOOLS_SPEC.json` operation classes that are genuinely list/read-like; analytical, planning, and mutating outputs remain unchanged.

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

- `keep_mcp_residual_session_sse_cleanup_package.md`
  - Removes residual unreachable GET-SSE, SessionStore, replay-helper, and push-emitter files from the active repo without changing the surviving `/mcp` contract.

- `keep_mcp_sampling_runtime_detachment_package.md`
  - Removes inactive sampling-context injection from active `/mcp` request handling after confirming there is no active request-session wiring left on the surviving route.

- `keep_mcp_rpc_response_observability_package.md`
  - Adds bounded server-side `rpc_response_sent` audit coverage for active `/mcp` request/response paths so runtime evidence can compare request interpretation with emitted responses by `request_id`.

- `keep_mcp_local_session_helper_classification.md`
  - Historical classification that bounded `session.js`, `sampling_context.js`, and helper-only `sendSessionRequest` before the dedicated retirement closeout.

- `keep_mcp_session_bound_outbound_sampling_scope.md`
  - Historical scoping record that bounded the remaining session-bound outbound/sampling internals before their dedicated retirement.

- `deprecated_sampling_helper_retirement_closeout.md`
  - Retires the unreachable `McpSession`, classic Sampling context, SSE outbound queue, and pending request registry while preserving explicit fail-closed response-envelope handling.

- `roots_sampling_logging_deprecation_inventory.md`
  - Finishes the missing roots/sampling/protocol-logging inventory so this deprecated bucket no longer stays in `unknown_needs_inventory` after sampling was detached from active `/mcp`.

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
  - Stage 14.9 workflow truth repair / state compaction. It records the restart/refresh recommendation rule and that the assistant can restart the workbench when workflow and important intent authorize it.

- `oauth21_prune_control_plane.md`
  - Bounded OAuth21 stale-state maintenance package. It records the explicit `Status` / `Plan` / `Execute` / `Rollback` control-plane contract, approval marker `operator_approved_oauth21_prune_apply`, backup/rollback records, and no-runtime-auto-apply boundary.

## Active remaining work queue

Current active queue is maintained in `_workflow/WORKFLOW_CANON.md` and this index. `_workflow/state.json` is only the compact machine-readable orientation map.

1. Execute `POL-1A-DLP`: add one centralized, fail-closed model-output validation/DLP boundary before optional tool payloads become MCP `content` / `structuredContent`.
2. Execute `POL-1A-CONSENT`: bind high-risk runtime operations to a server-verifiable consent artifact instead of relying on the current `guarded_process_execution` classification alone.
3. Execute `POL-1A-PROMPT`: add explicit untrusted-content classification and an instruction-promotion boundary for content-bearing tool results.
4. Follow with `POL-1B` for the four `partial` policies and `POL-1C` for the four non-critical `specified_only` policies.
5. Preserve the live-accepted Tasks/Trace/Artifacts/CIMD foundation, fixture-only MRTR evidence, completed `OPS-1`, and completed `DOC-2`.
6. Re-run `COMP-1A` only when real Codex client-entry traffic newer than `0.148.0-alpha.9` exists; run `COMP-1B` only if that evidence materially changes initialize-retirement.
Historical records remain traceability evidence, not the active queue.
`_workflow/control_plane/snapshots/**` is archival evidence only and must not be used as active interpretation.

Next recommended action: execute `POL-1A-DLP`. The completed critical-policy reconciliation now proves `13/24` required policies implemented. `transport_security` gained a fail-closed Origin boundary under RED→GREEN evidence, `scope_minimization` gained OAuth21/internal `mcp:tools` enforcement at tool dispatch, and `session_security` was reconciled to the stateless 2026-07-28 target. Three critical policies remain genuine runtime gaps: consent, prompt/content, and output DLP. These repository runtime changes still require a controlled OAuth21 3008 live load; no connector-visible descriptor or schema change is intended.
Readiness-derived default next package queue:

1. `POL-1A-DLP` — centralized model-output validation/DLP boundary
2. `POL-1A-CONSENT` — server-verifiable high-risk consent boundary
3. `POL-1A-PROMPT` — untrusted-content classification and instruction-promotion boundary
4. `POL-1B` — partial policy reconciliation
5. `POL-1C` — specified-only non-critical reconciliation
6. `COMP-1A` — event-gated protocol evidence; refresh only for real Codex traffic newer than `0.148.0-alpha.9`
7. `COMP-1B` — conditional on material `COMP-1A` change

Recently completed:

- Accepted `OPS-1B` on August 17, 2026: connector-visible TEST MCP used external config ref `C:\Work\www\remote-site-tools-config.json`; live `list_remote_site_files` returned the real two-file site root, `read_remote_site_file` returned the retained `41`-byte smoke file, and `remote_site_runtime_status` reported `healthy` with no warnings. No remote mutation occurred. `OPS-1` is now `4/4`; no runtime restart, connector refresh, credential migration, or `www` repository change was required.

- Refreshed `COMP-1A` on August 17, 2026: the current operational window `server_start_id 2026-08-16T19:04:37.288Z` shows `codex-mcp-client 0.148.0-alpha.9` remains `initialize_only` with `3` successful legacy `initialize` entries and `0` `server/discover` entries on protocol `2025-06-18`; initialize retirement remains blocked only by the Codex family.

- Completed `MRTR` on August 16, 2026: fixture-only official-client conformance proves `input_required` elicitation, exactly one retry with a fresh JSON-RPC id, preserved arguments, byte-exact opaque `requestState`, keyed `inputResponses`, and final `complete` semantics without production `src/` changes or a second task/session store. Clean-history run `31963602072` passed `7 + 305` plus post-suite clean-tree verification. Its runtime surface is deliberately non-applicable; the later controlled load preserved the `98`-tool runtime without introducing an MRTR tool or store.

- Live-loaded the P0-P3 protocol foundation on August 16, 2026: supervisor restart `manual-1786907075795` loaded final source `737cdc8b97ec1e966823dc2566eb7d5cd221e9b6` at `server_start_id 2026-08-16T19:04:37.288Z`. Live acceptance proved Tasks negotiation/completion, W3C request-to-execution ancestry, immutable Task artifacts plus authenticated `resources/read`, and CIMD special-use-IP SSRF rejection. At that checkpoint OAuth reconnect/recovery was accepted while SFTP was still unverified; the August 17 `OPS-1B` closeout above supersedes that remaining-boundary status.
- Refreshed `COMP-1A` on August 16, 2026: selected operational Codex entry window `server_start_id 2026-08-13T19:41:25.994Z` shows `codex-mcp-client 0.147.0-alpha.6.6` remains `initialize_only` with `4` matching legacy entries and `0` `server/discover` entries. Independent operational `openai-mcp 1.0.0` traffic uses `server/discover` with protocol `2026-07-28`; initialize retirement remains blocked only by the Codex family.

- Completed `OPS-1A` on August 9, 2026: the evidence-classified operational matrix and bounded runner passed `56/56` invocations, including three live Cloudflare and three live MCP network probes. Full operator-driven reconnect and live SFTP remain explicit external boundaries, not automated green claims.

- Completed `MCP-OFFICIAL-SDK-V2-INTEROP` on August 2, 2026: exact dev dependency `@modelcontextprotocol/client@2.0.0` proves default legacy, automatic modern, and pinned `2026-07-28` negotiation on isolated servers; all clients list and call tools, and hermetic server audit assertions prove the actual entry paths. The authenticated extension additionally proves SDK-driven DCR, PKCE S256, callback `state`/`iss`, issuer-bound persistence, an 84-tool authorized list/call, process-restart recovery from SQLite, and automatic refresh-token rotation after restart. Full validation is `7 + 272`; production port `3008` was not touched.

- Refreshed `COMP-1A` on August 2, 2026: current live `server_start_id 2026-08-01T20:29:11.207Z` shows operational `codex-mcp-client 0.146.0-alpha.9.2` remains `initialize_only` with `2` matching legacy entries and `0` `server/discover` entries.

- Completed `MCP-2026-DUAL-ERA` on August 1, 2026: final MCP `2026-07-28` request metadata, mirrored headers, result envelopes, server identity metadata, error codes, cache directives, and DCR `application_type` compatibility are live behind explicit era and auth gates. Full validation is `7 + 270`; restart `manual-1785616149554` loaded `server_start_id 2026-08-01T20:29:11.207Z`, and direct `workbench.get_info` succeeded without relogin. Fresh `codex-mcp-client 0.146.0-alpha.9.2` evidence still blocks initialize retirement.

- Refreshed `COMP-1A` on August 1, 2026 with `--latest-entry-window`: selected entry window `2026-08-01T17:51:19.986Z` shows operational `codex-mcp-client 0.146.0-alpha.9.2` remains `initialize_only` with `2` legacy entries and `0` `server/discover` entries.

- Refreshed `COMP-1A` on July 28, 2026 with `--latest-entry-window`: latest live runtime `2026-07-28T16:05:12.562Z` is stale for entry-path purposes, while selected entry window `2026-07-28T03:49:00.666Z` shows operational `codex-mcp-client 0.146.0-alpha.3.1` remains `initialize_only` with `2` successful legacy responses and `0` `server/discover` entries.

- Refreshed `COMP-1A` on July 27, 2026 against explicit live `server_start_id = 2026-07-27T03:10:26.042Z`: operational `openai-mcp 1.0.0` on protocol `2025-11-25` remains `initialize_only` with `8` successful responses and `0` `server/discover` entries. The shared child-server helper now isolates audit output, and the report can select and attribute a named live window without rewriting historical audit evidence.

- Completed one bounded `DOC-2A` fallback on July 27, 2026: `scripts/generate_directory_docs.js` now owns generator-owned maps for `src/integrations` and `src/integrations/codebase_memory`; the child map names native transport, contract registry, runtime orchestration, versioned contracts, and the repository/runtime/index truth boundary.

- Completed one bounded `DOC-2A` fallback on July 29, 2026: `scripts/generate_directory_docs.js` now owns generator-owned maps for `docs/superpowers`, `docs/superpowers/plans`, and `docs/superpowers/specs`; `_tests/smoke_directory_docs_audit.js` now guards top25/churn>=5, and the current audit reports no missing maps in that bounded scope.

- Completed upstream issue review through ordinals 201-277 on July 29, 2026: `docs/CBM_UPSTREAM_ISSUES_201_277_REVIEW.md` records the selected-comment review and local action. The `using-codebase-memory` skill now routes documentation/workflow retrieval to `workbench` `profile=knowledge` and keeps CBM scoped to indexed code-graph work.

- Completed `RETR-1` active-workflow ranking on July 29, 2026: `workspace_index` now recognizes planning/workflow intent and ranks `_workflow/ACTIVE_WORKFLOW_INDEX.md`, `_workflow/READINESS.md`, and `_workflow/ROADMAP.md` before historical operator decisions. Guarded by `_tests/smoke_build_index_tool.js`; live `workbench` validation passed after restart `manual-1785343566402`.

- Completed `RETR-1` structural document graph on July 29, 2026: `knowledge_summary.document_graph` now exposes deterministic internal document references, linked-node coverage, top linked docs, active entrypoint outgoing links, source-of-truth link coverage, and unresolved-reference samples. The implementation is dependency-free and intentionally does not introduce vector storage or LLM extraction.

- Completed `RETR-1-QUALITY-REGRESSION` on August 1, 2026: the v3 index detects stale source snapshots, parses complete canonical workflow tables through a bounded transient sample, handles escaped and code-span pipes, and ranks identifiers and direct proof deterministically. Full offline and live connector acceptance passed after controlled restart without OAuth relogin.

- Completed `UPSTREAM-PATTERN-LAB` on July 29, 2026: `scripts/extract_upstream_repo_patterns.js` inspects the local `_repos_with_code_samples` corpus and emits `docs/UPSTREAM_REPO_PATTERN_LAB.md` so future retrieval/memory work starts from audited upstream patterns rather than ad hoc tool lists.

- Completed the upstream second pass and `CBM-SNIPPET-INTEGRITY` package on July 29, 2026: the extractor records exact nested Git pins, dependency costs, source-definition evidence, and adoption/defer decisions. A fresh native reindex reproduced incorrect `get_code_snippet` line metadata for `searchIndex`; the bridge now verifies requested-symbol presence and either recovers a bounded range from a verified workspace file or marks source unreliable. Restart `manual-1785348037500` loaded the package, and the live connector returned corrected lines `1073-1084` with native lines `898-909` preserved.

- Closed test-harness control-state pollution on July 27, 2026: self-test no longer starts the restart controller or writes tool-surface state; every smoke child-server uses hermetic surface/restart/rate paths; standalone harnesses, ordinary self-test, and the full suite preserve the restored operational 84-tool state byte-for-byte. No additional restart was required.

- Completed CBM reliability hardening, native-cache repair, and final live load on July 27, 2026: stdin payload transport, duplicate `detect_changes` normalization, fail-fast runtime output configuration, operator-neutral executable fallback, fail-closed ADR snapshot gating, exact OAuth/HTTP helper consolidation, and transactional migration of all three active cache databases are live at `server_start_id = 2026-07-27T03:10:26.042Z`. `manage_adr(get)` succeeds without reindexing; post-refresh delete verification returned `deleted` then `cbm_project_not_found`; full offline smoke is GREEN at `7 + 266`.
- Completed CBM subprocess root-fidelity hardening on August 17, 2026: probe and native tool subprocesses use the resolved authorized root for both cwd and `CBM_ALLOWED_ROOT`. Full suite job `e521f92c-f28c-4c11-a0de-bd5f625f7183` passed `7 + 306`; restart `manual-1786979475830` loaded commit `cbdc12c` at `server_start_id = 2026-08-17T15:11:17.544Z`, and live `cbm_status` plus `cbm_list_projects` are green.
- Completed CBM bridge sample-repo stress closeout on July 28, 2026: `_tests/stress_cbm_bridge_samples.js` validates every exposed CBM bridge tool across selected `_repos_with_code_samples`; the strict default run covered `663` exact recorded calls across all fifteen `cbm_*` tools, including lifecycle `index_repository`/`delete_project`, with `instability=[]`; earlier large-repo stress also stayed stable, and `cbm_search_code` now filters volatile native search-latency warnings from stable result signatures.
- Completed upstream issue review through ordinals 51-100 on July 28, 2026: `docs/CBM_UPSTREAM_ISSUES_51_100_REVIEW.md` records applied local caveats for broader source-bearing excluded-route detection, Windows non-ASCII `search_code`, unsupported Cypher shapes, and resident-set discovery interpretation. The package is live at `server_start_id = 2026-07-28T15:25:30.678Z`.

- Applied the bounded surviving-route transport-session retirement package: stable `/mcp` no longer creates transport sessions, no longer emits `Mcp-Session-Id`, ignores session headers on POST, and now reports `protocol_sessions: false` from `server/discover`.

- Verified cleanup/normalization closeout on `main`: cleanup anchor `aecec58` remains in `main` history, `node server.js --self-test` is green, and `node _tests/run_all_smokes.js --skip-network` is green with `7` public and `220` authenticated scripts.

- Added `_tests/smoke_historical_next_recommendation_quarantine.js` and rewrote lingering historical `Next recommendation` leakage so completed side records no longer masquerade as the active queue.

- Recorded repo-side no-handshake evidence for the surviving `/mcp` route: `server/discover` plus useful `tools/list` / `tools/call` behavior no longer depend on a preceding `initialize`.

- Refreshed the bounded `COMP-1A` client-entry package on July 17, 2026: the current live OAuth21 `3008` window still shows `initialize_only` for `codex-mcp-client 0.145.0-alpha.18`, and the retained blocker already exists in the freshest `1d` and `2d` operational windows, so the queue now falls back to `DOC-2A` until new external traffic appears.

- Completed the bounded `DOC-2A` fallback on July 17, 2026 by extending `DIRECTORY.md` coverage into the runtime-owned control-plane backup roots and the live OAuth21 prune backup bundle, without widening that rollout into repo-wide documentation churn.

- Recorded real client compatibility evidence for the surviving `/mcp` route: a freshly re-added Codex desktop Streamable HTTP connector can complete OAuth and still call legacy `initialize`, so bounded dual recognition remains temporary compatibility debt only.

- Closed the stale `session_store` and `roots_sampling_logging_deprecation` ledger items using the already-recorded local-helper classification and sampling-detachment truth.

- Closed the stale `restart_resilience` ledger item using the already-recovered supervisor-managed OAuth21 `3008` restart authority and runtime topology spec truth.

- Confirmed the previous dirty-worktree push blocker is closed on `main`; the cleanup-closeout checkpoint preserved only local-only untracked directories `.codebase-memory/` and `_workflow/experiments/` outside the committed repo surface.

- Added explicit archive-boundary README files for `_workflow/historical/`, `_tests/archive/`, and `_tests/archive/legacy_retired_auth/`, then extended `smoke_state_and_snapshot_hygiene.js` so archived evidence is less likely to be mistaken for active workflow truth.

- Added an archival-quarantine README for `_workflow/control_plane/retired_root_backups/` and extended `smoke_state_and_snapshot_hygiene.js` so legacy moved root backups are not misread as active route/test/workflow authority.

- Added the bounded OAuth21 prune control-plane package for stale durable OAuth state maintenance, including preview/receipt/gate/apply helpers, an explicit operator-run script, execute/rollback records, and regression coverage without wiring automatic runtime apply.

- Revalidated that `mcp__workbench` is callable again from the current Codex model runtime session, without overstating that as a fresh full UI visible-tool enumeration proof.

- Completed a bounded remote-site lifecycle hardening package on `main`: read-only remote-site flows (`list`, `read`, runtime status, retention preview) no longer create remote ops directories as a side effect. Guard coverage: `_tests/smoke_remote_site_lifecycle.js`; full suite still green via `node _tests/run_all_smokes.js --skip-network`.

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
