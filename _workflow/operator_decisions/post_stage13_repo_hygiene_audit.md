# Post-Stage 13 Repo Hygiene and Debt Audit

Status: GREEN / AUDIT ONLY
Date: 2026-06-24

## Purpose

This audit prepares the repository for a Stage 14 proposal. It checks whether Stage 13 left workflow debt, whether code health is green, and which open work items should remain in the active queue.

## Code health

- Repo start HEAD: c368433.
- Starting working tree: clean.
- `node _tests/run_all_smokes.js --skip-network`: ok, version 0.40.0, runtime label stage8_20-runtime-status-compact-mode, public=6, tests_authenticated=157.
- `node server.js --self-test`: ok, outputMode=structured, connectorShapeVersion=2025-05-strict-v1.
- `npm test`: not runnable in this process-runner environment because npm is allowlisted but not available in PATH (`spawn npm ENOENT`). This is tool-environment ergonomics, not repo test failure.

## Workflow hygiene findings

- No unchecked Markdown task boxes were found under _workflow.
- State current work package is Stage 13 closeout and Stage 13 status is green_closed.
- Stage 13 closeout explicitly records no Stage 14 implementation approval.
- Active next_allowed_work contains proposal/recommendation work only plus explicit approval boundaries.
- Historical `pending_commit` strings are confined to legacy whitelist compatibility in `_tests/smoke_stage12_streamable_http_workflow_plan.js`; no active pending commit was found.
- Historical stage3 legacy pending counters still exist as historical snapshots, while current counters are zero. Leave as history; do not treat as active debt.
## Active remaining work queue

1. Runtime Enforcement Apply Package - no-apply proposal first.
   - Basis: Stage 12 readiness says ready_for_operator_review=true and ready_for_runtime_enforcement=false.
   - Why first: clearest continuation of Stage 10-12 policy work with existing guards/readiness artifacts.
   - Boundary: proposal/no-apply first; no runtime enforcement, deny behavior, deploy, restart or connector refresh without later approval.

2. Cooperative Tool Cancellation C3.
   - Basis: Stage 7 completed C1 AbortSignal plumbing and C2 no-write-after-close guard; C3 cooperative tool cancellation sample remains deferred.
   - Why second: contained runtime-quality improvement with existing cancellation context.
   - Boundary: preserve timeout fallback and avoid sessionless migration.

3. Event-driven Hotplug Lifecycle.
   - Basis: Stage 8-9 registry foundations and list_changed dry-run stack exist; P6 defines HPL1-HPL6.
   - Why third: high value, but tool-surface mutation and list_changed behavior are connector-sensitive.
   - Boundary: begin with proposal or local harness only; no real tool-surface mutation or connector refresh without approval.

4. Sessionless / Explicit State Handles Target Selection.
   - Basis: P5 and Stage 7 inventory record the official direction and current stable-session compatibility dependencies.
   - Why fourth: strategically important but broad and protocol-sensitive.
   - Boundary: target-selection/proposal first; no transport migration in the proposal audit stage.

5. Legacy Retired Auth Test Archive/Cleanup.
   - Basis: legacy retired auth manifest classifies rewrite/archive/delete candidates; active run_all no longer includes retired tests.
   - Why lower priority: hygiene value, limited runtime value.
   - Boundary: no hard delete without explicit archive/delete decision.

6. CRLF Batch Normalization.
   - Basis: Stage 13.3 found 191 tracked text files with CRLF.
   - Why lower priority: pure hygiene; risk is diff churn.
   - Boundary: only separate small-batch migration, not incidental cleanup.

## Recommendation for Stage 14 proposal

Prepare Stage 14 as `Runtime Enforcement Apply Package - No Apply`. It should be a proposal/verification package, not runtime enforcement. The proposal must show hook points, exact files, rollback/restart/deploy implications, connector-visible impact, validation plan, and explicit non-actions. Implementation still requires separate operator approval.

## Non-actions

- no Stage 14 implementation approval
- no runtime code patch
- no deploy
- no runtime restart
- no connector refresh
- no public connector reconnect
- no runtime enforcement
- no allow/deny behavior change
- no dispatch behavior change
- no hotplug/list_changed emission
- no sessionless migration
- no mass CRLF normalization
- no git add --renormalize .
