# Stage 14.1 - Runtime Enforcement Apply Package, No Apply

Status: GREEN / PACKAGE STARTED / NO APPLY
Date: 2026-06-24

## Scope

Stage 14 starts the Runtime Enforcement Apply Package without applying runtime enforcement. This package converts the Stage 10-12 readiness work into an operator-reviewable apply package shape. It does not modify runtime-imported code, does not wire policy preflight into `tools/call`, and does not change allow/deny behavior.

## Source-derived current state

- `src/runtime/tools_call_handler.js` already builds `decisionContext`, evaluates `evaluateDecisionRuntimePolicy`, builds `decisionReceipt`, and audits `tool_call_decision` before input validation and handler execution.
- `src/runtime/decision_runtime_policy.js` currently enforces compatibility/basic policy only: known tool, profile allowance, auth-required denial, public-safe constraints, public filesystem scope, and destructive-tool denial.
- `src/policy_enforcement_coverage_matrix.js`, `src/policy_preflight_reason_codes.js`, and `src/policy_preflight_receipt.js` provide dry-run policy coverage, reason codes, and redacted receipt shapes.
- `src/enforcement_apply_readiness_report.js` reports review readiness but keeps `ready_for_runtime_enforcement=false` and `runtime_enforcement_enabled=false`.
- `src/enforcement_wiring_plan.js` identifies the future hook in `src/runtime/tools_call_handler.js` but has `mode=plan_only_no_apply` and `apply_allowed_now=false`.
- `src/enforcement_operator_approval_guard.js` defines marker id `operator_approved_runtime_policy_enforcement_apply`, but Stage 14.1 does not record or consume an approval marker.
- `SERVER_POLICY_RUNTIME_SPEC.json` and `SERVER_RESOURCE_POLICY_SPEC.json` still declare runtime enforcement as not enabled.

## Future apply hook map

If a later operator-approved apply stage is accepted, the likely hook is:

```text
tools_call_handler.handleToolsCall
  -> buildDecisionRuntimeContext
  -> evaluateDecisionRuntimePolicy
  -> buildDecisionRuntimeReceipt
  -> audit tool_call_decision
  -> FUTURE OPERATOR-APPROVED policy preflight enforcement hook
  -> input validation
  -> tool_call_start
  -> handler execution
```

The future hook must remain before `tool_call_start` and before handler execution so a denied call does not run the tool.

## Required future apply artifacts

A later apply stage must provide at least:

1. Operator approval marker with id `operator_approved_runtime_policy_enforcement_apply`.
2. Exact runtime code diff plan for `src/runtime/tools_call_handler.js` and any helper module.
3. Deterministic JSON-RPC denial shape for policy-denied calls.
4. Audit event contract for runtime policy denial.
5. Redacted policy receipt attached to the audit path, with no raw argument values.
6. Negative controls proving no behavior change without marker/config.
7. Regression controls proving allowed tools still execute unchanged.
8. Restart/deploy/rollback plan for runtime-imported code.
9. Connector-visible impact review.
10. Full run_all and live validation plan.

## Stage 14.1 decision

Stage 14.1 starts the package as reviewable no-apply work only. It is not an implementation approval. It records the future hook map and required artifacts so the operator can decide whether to proceed to an apply design or stop.

## Boundary

server_change: false
workflow_change: true
schema_change: false
runtime_restart_required: false
connector_refresh_required: false
backup_required: false
rollback_path: revert workflow-only documentation/state/test-guard changes
restore_path: this record plus workflow canon, active index, state, guard, manifest, and compatibility workflow guards

## Non-actions

- no runtime-imported code change
- no Stage 14 runtime enforcement apply
- no approval marker recorded
- no tools_call_handler wiring
- no runtime policy denial behavior change
- no allow/deny behavior change
- no dispatch behavior change
- no deploy
- no runtime restart
- no connector refresh
- no public connector reconnect
- no hotplug/list_changed emission
- no sessionless migration
- no CRLF normalization
