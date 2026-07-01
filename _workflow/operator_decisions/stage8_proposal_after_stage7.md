# Stage 8 Proposal After Stage 7

Status: proposal only
Date: 2026-06-21

## Proposed title

Stage 8 - Static Registry Foundation Before Hotplug and Policy Enforcement

## Why Stage 8 should not start with full hotplug or full policy enforcement

Stage 7 is focused on convergence and sessionless readiness. The next implementation stage should avoid changing connector-visible behavior, security boundaries, or protocol mode all at once.

The safest Stage 8 foundation is a static-equivalence registry layer:

- it supports future Hotplug HPL1;
- it supports future Resource/Scope Matrix R1/R2 because policy can resolve against the same registry/catalog model;
- it does not require connector refresh if output is equivalent;
- it does not emit list_changed;
- it does not change tools/list surface.

## Recommended Stage 8 scope

### 8.1 Tool registry static abstraction

Create an internal registry abstraction that can load and render the current static tool surface exactly as the existing loader does.

Non-goals:

- no dynamic registration;
- no runtime mutation;
- no real list_changed emission;
- no connector refresh;
- no public connector reconnection.

Expected guard:

- `_tests/smoke_static_tool_registry_equivalence.js`

Acceptance:

- public surface remains 13 tools;
- authorized runtime remains 43 tools;
- descriptor/schema fingerprints stay equivalent;
- full `run_all --skip-network` remains green.

### 8.2 Registry-to-policy read model

Expose a read-only internal model that maps each tool to:

- descriptor;
- surface class;
- tool policy summary;
- catalog metadata from `SERVER_TOOLS_SPEC.json` where available.

Non-goal: no enforcement behavior change.

Acceptance:

- model is deterministic;
- missing metadata fails in tests, not runtime;
- no runtime deny behavior change.

### 8.3 Registry diff dry-run

Connect registry snapshots to existing `tools_list_diff.js` and `list_changed` dry-run stack.

Non-goal: no real event emission.

Acceptance:

- add/remove/update diff examples are deterministic;
- existing list_changed dry-run tests remain green;
- no live runtime event emission.

## Why this should precede runtime policy expansion

Runtime policy expansion will need authoritative tool metadata at decision time. Creating the registry abstraction first avoids hard-coding policy lookups and reduces future security-boundary risk.

## Why this should follow Stage 7

Stage 7 should first close live/repo convergence, record sessionless inventory, and optionally implement C1 cancellation context plumbing. Stage 8 should begin only after Stage 7 commits are green.

## Explicit approvals required before expanding beyond this proposal

Separate operator approval is required before any of the following:

- live connector refresh;
- public connector reconnection;
- real list_changed emission;
- state-store writes;
- dynamic tool registration/unregistration;
- runtime policy denial/enforcement changes;
- protocol migration to draft/sessionless behavior.
