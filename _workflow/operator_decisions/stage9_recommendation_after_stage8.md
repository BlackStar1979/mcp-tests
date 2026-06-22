# Stage 9 Recommendation After Stage 8

Status: recommendation only
Date: 2026-06-22

## Context

Stage 8 created a static registry foundation without enabling hotplug, real list_changed emission, connector refresh, or runtime policy enforcement changes.

Completed Stage 8 components:

1. Stage 8.1 - Static tool registry abstraction.
2. Stage 8.2 - Registry-to-policy read model.
3. Stage 8.3 - Registry diff dry-run.

## Recommended Stage 9 title

Stage 9 - Registry-backed Runtime Read Model Integration

## Rationale

Stage 8 added registry modules and validation, but runtime code still largely consumes static loader output directly except for `runtime_support_assembly.toolsList()`.

The next safe step is not real hotplug and not runtime policy enforcement. The next step should make the registry read model available inside runtime/context paths while preserving exact visible behavior.

This gives future hotplug and future Resource/Scope Matrix Enforcement a shared internal read model before either becomes active.

## Recommended Stage 9 scope

### 9.1 Runtime registry context assembly

Create an internal context component that can build:

- static registry;
- registry policy read model;
- registry diff snapshot;

from the same inputs already used by runtime assembly.

Non-goals:

- no dynamic registration;
- no runtime mutation;
- no list_changed emission;
- no enforcement/deny behavior change;
- no connector refresh.

### 9.2 Runtime status read-only registry summary

Add a compact, redacted registry summary to internal runtime status or an internal-only helper, if it does not change connector-visible schema unexpectedly.

Preferred first step: internal helper + tests only.

If exposed through `test_mcp_runtime_status`, update schemas and validate connector shape before live restart. Do not expose without explicit review.

### 9.3 Registry-policy consistency guard in run_all

Add a run_all guard that verifies current public and authorized registry read models remain consistent with:

- descriptors;
- `TOOL_POLICIES`;
- `SERVER_TOOLS_SPEC.tool_catalog`;
- expected tool counts/hashes.

This should remain test-only and should not affect runtime call decisions.

## Why not start Stage 9 with HPL1 real hotplug

Real hotplug would require state-store writes, list_changed emission, client invalidation behavior, and operator approval for dynamic tool-surface mutation. Stage 8 deliberately stopped before that boundary.

## Why not start Stage 9 with R1 policy enforcement

Runtime policy enforcement changes are security-boundary changes. The read model should first be available and stable in runtime context before enforcement is introduced.

## Alternative paths if operator chooses differently

1. C3 cooperative tool cancellation sample
   - Good if resource cleanup is the immediate priority.
   - Touches tool execution behavior, so keep it separate.

2. R1 runtime policy spec loader
   - Good if policy enforcement is the immediate priority.
   - Requires explicit operator approval before any deny behavior changes.

3. HPL1 dynamic registry abstraction
   - Good if hotplug is the priority.
   - Must remain disabled by default until state-store/list_changed gates are ready.

## Explicit approvals required before expanding beyond this recommendation

Separate operator approval is required before:

- connector refresh;
- public connector reconnection;
- real registry mutation;
- real tools/list mutation;
- real `notifications/tools/list_changed` emission;
- runtime policy deny/enforcement changes;
- Sessionless MCP migration;
- cooperative cancellation across real tool handlers.
