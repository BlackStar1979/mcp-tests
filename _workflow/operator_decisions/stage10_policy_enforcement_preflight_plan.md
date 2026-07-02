# Stage 10 Policy Enforcement Planning-to-Preflight

Status: plan/preflight only
Date: 2026-06-23

## Purpose

Stage 10 prepares Resource/Scope Matrix Enforcement without changing runtime allow/deny behavior.

Stage 9 created the registry-backed read model needed to reason about descriptors, runtime `TOOL_POLICIES`, and `SERVER_TOOLS_SPEC.tool_catalog` consistently. Stage 10 should now produce a deterministic preflight layer that says what would be enforced, what would be denied, and what is still missing, without actually denying any tool call.

## Scope boundary

Allowed in Stage 10:

- read-only enforcement plan generation;
- dry-run preflight evaluation;
- consistency checks against registry read model and policy specs;
- stable reason-code design;
- audit receipt shape design;
- run_all guards proving no runtime behavior change.

Forbidden without separate operator approval:

- real runtime policy enforcement;
- any allow/deny behavior change;
- connector refresh;
- public connector reconnection;
- real registry mutation;
- real tools/list mutation;
- real `notifications/tools/list_changed` emission;
- state-store writes;
- Sessionless MCP migration.

## Recommended Stage 10 sequence

### 10.1 Enforcement coverage matrix preflight

Create a test-only/internal helper that maps every visible tool to:

- descriptor summary;
- runtime `TOOL_POLICIES` summary;
- `SERVER_TOOLS_SPEC.tool_catalog` summary;
- applicable resource class;
- operation class;
- profile/surface class;
- policy references;
- enforcement readiness status.

Result should be a deterministic report with no runtime behavior change.

Expected guard:

- `_tests/smoke_policy_enforcement_coverage_matrix.js`

### 10.2 Deny reason-code design and dry-run evaluator

Define stable dry-run reason codes, for example:

- `missing_tool_policy`
- `missing_catalog_entry`
- `profile_not_allowed`
- `public_tool_not_public_safe`
- `resource_class_missing`
- `operation_class_mismatch`
- `policy_ref_missing`
- `destructive_tool_blocked`

Expected guard:

- `_tests/smoke_policy_preflight_reason_codes.js`

### 10.3 Audit receipt shape for future enforcement

Design a redacted audit receipt for future enforcement decisions. It should include:

- tool name;
- profile/auth mode;
- resource class;
- operation class;
- policy refs;
- reason code;
- would_allow / would_deny;
- redacted argument shape/hash only.

Expected guard:

- `_tests/smoke_policy_preflight_receipt_shape.js`

### 10.4 No-behavior-change guard

Prove Stage 10 preflight is not wired into `tools/call` enforcement.

Expected guard:

- current decision-runtime negative controls remain unchanged;
- `run_all --skip-network` remains green;
- runtime status schemas remain unchanged.

## Recommended first step

Start with **10.1 Enforcement coverage matrix preflight**.

Reason: it is read-only, gives the clearest visibility into policy gaps, and reduces risk before any future deny behavior is considered.

## Non-goals for Stage 10.1

- no enforcement;
- no request argument extraction;
- no audit event emission;
- no connector-visible output;
- no runtime status schema change.

## Completion criteria for Stage 10 closeout

Stage 10 can close when:

- a deterministic enforcement coverage matrix exists;
- reason codes are defined and tested;
- future receipt shape is tested;
- full `run_all --skip-network` remains green;
- workflow records explicitly state that runtime deny behavior is still unchanged.
