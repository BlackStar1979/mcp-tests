# Stage 11 Policy Gap Remediation Plan

Status: plan/start
Date: 2026-06-23

## Purpose

Stage 11 remediates declarative policy gaps found by Stage 10 preflight while keeping runtime enforcement disabled.

Stage 10 found:

- public preflight blocked: 0;
- authorized preflight blocked: 3;
- blocked tools:
  - `plugin_execution_governance`;
  - `plugin_visibility_status`;
  - `plugin_catalog_search`;
- reason: `operation_not_allowed_for_resource_class`.

## Boundary

Allowed in Stage 11:

- update declarative policy/catalog specs when the intended semantics are clear;
- add regression guards proving the Stage 10 preflight gap is closed;
- keep runtime behavior unchanged;
- keep connector-visible schemas unchanged.

Forbidden without separate operator approval:

- runtime policy enforcement;
- any allow/deny behavior change;
- connector refresh;
- public connector reconnection;
- real registry mutation;
- real tools/list mutation;
- real `notifications/tools/list_changed` emission;
- Sessionless MCP migration.

## Recommended sequence

### 11.1 Remediate Stage 10 declarative policy gaps

Inspect the three blocked tools and the resource/operation policy definitions, then choose the minimal declarative fix.

Expected result:

- Stage 10 coverage matrix reports authorized blocked=0;
- Stage 10 reason-code dry-run reports authorized would_deny=0;
- no runtime enforcement is enabled.

Expected guard:

- `_tests/smoke_stage11_policy_gap_remediation.js`

### 11.2 Update Stage 10 expectation guards

After remediation, update Stage 10 guards from expected authorized blocked=3 / would_deny=3 to blocked=0 / would_deny=0.

### 11.3 Close Stage 11

Close with full `run_all --skip-network` green and explicit statement that runtime deny behavior is still unchanged.

## Non-goals

- no runtime `tools/call` enforcement;
- no policy middleware;
- no deployment/restart;
- no connector refresh;
- no schema exposure changes.
