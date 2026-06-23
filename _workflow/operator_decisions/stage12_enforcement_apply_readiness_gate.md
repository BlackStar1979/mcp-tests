# Stage 12 Recommendation - Enforcement Apply-Readiness Gate

Status: recommendation only
Date: 2026-06-23

## Context

Stage 10 introduced policy enforcement planning-to-preflight only:

- coverage matrix preflight;
- dry-run reason-code evaluator;
- redacted policy preflight receipt shape.

Stage 11 remediated the declarative policy gaps found by Stage 10:

- `plugin_execution_readonly` now allows `read`;
- `plugin_visibility_state_preview` now allows `read`;
- `plugin_registry_readonly` now allows `search`.

After Stage 11.1:

- public blocked: 0;
- public would_deny: 0;
- authorized blocked: 0;
- authorized would_deny: 0.

Runtime enforcement remains disabled. Runtime allow/deny behavior remains unchanged.

## Recommended Stage 12 title

Stage 12 - Enforcement Apply-Readiness Gate

## Purpose

Stage 12 should decide whether the project is ready to introduce a future runtime enforcement gate, but should still not enable enforcement by default.

The target is an explicit, testable, operator-controlled readiness gate that answers:

- Is the policy matrix complete?
- Are reason codes stable?
- Are receipt shapes stable and redacted?
- Are connector-visible schemas unchanged?
- Which explicit approval would be needed before wiring enforcement into `tools/call`?

## Recommended Stage 12 scope

### 12.1 Enforcement apply-readiness report

Add a read-only report that combines:

- Stage 10 coverage matrix;
- Stage 10 reason-code dry-run evaluation;
- Stage 10 receipt shape readiness;
- Stage 11 remediation result;
- negative controls proving runtime enforcement is still disabled.

Expected output:

- `ready_for_operator_review: true` when all preflight signals are green;
- `ready_for_runtime_enforcement: false` until operator explicitly approves real enforcement wiring;
- no behavior changes.

### 12.2 Enforcement wiring plan, no apply

Create a deterministic plan for where a future runtime policy enforcement hook would be inserted.

This should identify code paths and required tests, but must not change dispatch behavior.

### 12.3 Operator approval boundary guard

Add a guard that fails if any Stage 12 work enables runtime enforcement without an explicit approval marker.

## Explicit non-goals

Stage 12 must not, without separate explicit operator approval:

- enable runtime policy enforcement;
- change allow/deny behavior;
- change connector-visible schemas;
- refresh connector maps;
- reconnect the public connector;
- mutate tools/list dynamically;
- emit real `notifications/tools/list_changed`;
- migrate to Sessionless MCP.

## Recommended first step

Start with **12.1 Enforcement apply-readiness report**.

This is the lowest-risk bridge between the current preflight-only system and any later enforcement work.
