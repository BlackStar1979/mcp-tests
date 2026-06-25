# Stage 14.3 - Runtime Enforcement Apply Design Review, Still No Apply

Status: GREEN / APPLY DESIGN REVIEW / NO APPLY
Date: 2026-06-24

## Scope

Stage 14.3 reviews the future runtime enforcement apply design. It reassesses blockers, restart/connector/baseline/control-plane implications, denial shape, audit contract, and validation plan. It does not implement runtime enforcement and does not modify runtime-imported server code.

## Binding context

- Post-Stage6 D7 remains binding: Resource/Scope Matrix Enforcement is a security-boundary change and requires separate operator approval.
- Public connector remains disconnected unless explicit UI validation is needed.
- Sessionless / explicit state handles and event-driven Hotplug remain separate future architecture tracks.
- Stage 14.1 identified the future hook and required artifacts.
- Stage 14.2 and 14.2B cleaned workbench/control-plane debt and require control-plane paths for snapshot/deploy/rollback.
- `SERVER_POLICY_RUNTIME_SPEC.json` and `SERVER_RESOURCE_POLICY_SPEC.json` still declare runtime enforcement disabled.
- `_workflow/baselines/stage8_frozen_runtime_baseline.json` is the frozen surface baseline; do not update it automatically.

## Current source-derived hook

Current `src/runtime/tools_call_handler.js` flow:

```text
handleToolsCall
  -> buildDecisionRuntimeContext
  -> evaluateDecisionRuntimePolicy
  -> buildDecisionRuntimeReceipt
  -> audit tool_call_decision
  -> existing compatibility decision deny path, if decision.allow !== true
  -> input validation
  -> audit tool_call_start
  -> handler execution
```

Future operator-approved policy enforcement gate must sit after `tool_call_decision` and before input validation, `tool_call_start`, and handler execution. A policy-denied call must not emit `tool_call_start` and must not execute the handler.

## Blocker reassessment

| Blocker | Decision | Reason |
|---|---|---|
| Explicit operator approval marker | Keep | Runtime enforcement changes security boundary and allow/deny behavior. Required marker id remains `operator_approved_runtime_policy_enforcement_apply`. |
| Stage12-specific no-apply wording | Retire as future blocker text | The exact Stage12 blocker is historical. Future guards should use Stage14-specific no-apply/apply wording while preserving the approval boundary. |
| Exact runtime diff | Keep | Apply must identify exact edits before any mutation. |
| Restart planning | Keep for apply | Actual apply touches runtime-imported code and therefore requires test-server restart planning. Stage 14.3 itself does not require restart. |
| Connector refresh planning | Conditional | Pure runtime deny behavior with unchanged tools/list descriptors does not require connector refresh. Connector refresh is required only if MCP-visible tool descriptors, schemas, auth/profile visibility, tool count, or connector contract changes. Live connector validation may still be needed after apply, but validation is not the same as refresh. |
| Baseline refreeze | Conditional | Do not refreeze baseline if tool surface/fingerprints remain unchanged. A refreeze requires separate explicit connector-surface/baseline-change stage. |
| Control-plane snapshot/backup/deploy/rollback | Keep for apply | Any runtime code mutation/deploy must use `_workflow/control_plane` records before execution. Stage 14.3 itself is workflow-only and needs no backup. |
| Denial JSON-RPC contract | Keep | Apply must define deterministic error shape before code change. |
| Audit denial contract | Keep | Apply must define redacted denial audit event without raw argument values. |
| Negative and regression controls | Keep | Must prove denied calls do not execute and allowed calls remain unchanged. |

## Proposed future apply diff envelope

A later apply package, if explicitly approved, should be constrained to:

1. `src/runtime/tools_call_handler.js` - import future enforcement helper, call it after `tool_call_decision` and before input validation, return deterministic policy-denial JSON-RPC error when denied, and do not emit `tool_call_start` for denied calls.
2. New helper module under `src/runtime/`, for example `policy_enforcement_gate.js`, to evaluate policy receipts without raw argument leakage and preserve fail-closed semantics if evaluation fails.
3. Tests only under `_tests/` for apply controls.
4. Workflow/control-plane records only under `_workflow/` and `_workflow/control_plane/`.

No descriptor, schema, tool count, profile, auth, hotplug, sessionless, or connector-surface change should be included in the apply diff unless separately approved.

## Proposed future denial JSON-RPC shape

Future policy-denied tool call should return a deterministic JSON-RPC error, tentatively:

```json
{
  "jsonrpc": "2.0",
  "id": "<request id>",
  "error": {
    "code": -32602,
    "message": "Tool call denied by runtime policy",
    "data": {
      "decision_code": "runtime_policy_denied",
      "reason_codes": ["<stable reason code>"],
      "policy_receipt": {
        "schema_version": "policy-preflight-receipt-v1",
        "raw_arguments_included": false
      }
    }
  }
}
```

The final apply package must either accept this shape or explicitly replace it before implementation. Do not implement this in Stage 14.3.

## Proposed future audit contract

Future policy-denied call should emit a redacted audit event before returning the JSON-RPC error:

```text
event: tool_call_policy_denied
required fields:
  request_id
  tool
  duration_ms
  decision_code
  reason_codes
  decision_receipt
  policy_receipt
  raw_arguments_included=false
```

`tool_call_start` must not be emitted for policy-denied calls.

## Apply validation plan for later approved stage

Minimum tests for a later approved apply package:

1. Valid approval marker required; missing marker keeps apply disabled.
2. Policy-denied known tool returns deterministic JSON-RPC error.
3. Denied known tool does not emit `tool_call_start`.
4. Denied known tool handler is not executed.
5. Denial audit event is emitted with redacted receipt and no raw argument values.
6. Allowed public tool still executes unchanged.
7. Allowed authenticated/internal tool still executes unchanged in authorized profile.
8. Unknown tool behavior remains compatible.
9. Invalid argument behavior remains compatible and separate from policy denial.
10. `SERVER_POLICY_RUNTIME_SPEC.json` / `SERVER_RESOURCE_POLICY_SPEC.json` are updated only in the approved apply commit, not before.
11. Descriptor/tool-surface fingerprints remain unchanged, or a separate baseline/connector-surface decision is recorded.
12. Full `node _tests/run_all_smokes.js --skip-network` passes.
13. `node server.js --self-test` passes.
14. Live test-server restart and post-restart status validation are performed if runtime code is deployed.

## Restart, connector, baseline, and control-plane decision

For Stage 14.3 itself:

- runtime_restart_required: false
- connector_refresh_required: false
- baseline_refreeze_required: false
- backup_required: false
- deploy_required: false
- rollback_required: false

For a later approved runtime apply:

- runtime_restart_required: true, if live test server must run new code;
- connector_refresh_required: false if tools/list descriptors and connector contract are unchanged;
- connector_refresh_required: true if descriptors, schemas, auth/profile visibility, tool count, or connector contract changes;
- baseline_refreeze_required: false if fingerprints remain unchanged;
- baseline_refreeze_required: true only in a separate explicit connector-surface/baseline-change stage;
- control-plane snapshot/deploy/rollback plan: required before runtime mutation/deploy.

## Stage 14.3 decision

Proceed no further than design review. Recommended next step is Stage 14.4 - Runtime Enforcement Apply Package Draft, Still No Apply. Stage 14.4 should produce exact code diff plan, exact tests, control-plane deployment plan, and operator approval marker template, but still should not apply enforcement unless explicitly accepted.

## Boundary

server_change: false
workflow_change: true
schema_change: false
runtime_restart_required: false
connector_refresh_required: false
backup_required: false
baseline_refreeze_required: false
runtime_enforcement_changed: false
allow_deny_behavior_changed: false
dispatch_behavior_changed: false
rollback_path: revert Stage 14.3 workflow/state/test-guard changes
restore_path: this record, guard, state, canon, active index, and manifest

## Non-actions

- no runtime enforcement apply
- no runtime-imported code change
- no `tools_call_handler.js` wiring
- no approval marker recorded
- no runtime policy denial behavior change
- no allow/deny behavior change
- no dispatch behavior change
- no server restart
- no connector refresh
- no deploy
- no public connector reconnect
- no baseline refreeze
- no hotplug/list_changed emission
- no sessionless migration
- no CRLF normalization


## Final validation

- `node _tests/smoke_stage14_3_runtime_enforcement_apply_design_review.js`: ok.
- `node _tests/smoke_stage14_2b_repo_gremlin_double_scan.js`: ok.
- `node _tests/smoke_stage12_enforcement_wiring_plan_no_apply.js`: ok.
- `node _tests/smoke_stage12_operator_approval_boundary_guard.js`: ok after one tool-layer retry.
- `node _tests/smoke_stage12_oauth_production_hardening_plan.js`: ok after historical next-work guard update.
- `node server.js --self-test`: ok.
- `node _tests/run_all_smokes.js --skip-network`: ok, public=6, tests_authenticated=163.
