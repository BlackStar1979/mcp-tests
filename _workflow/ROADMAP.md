# Roadmap

Status: active dependency-aware roadmap
Updated: 2026-07-15

## Purpose

Maintain the current prioritized work queue in an operator-facing format that is easier to audit than scattered TODO notes.

## Priority matrix

| Priority | Item | Depends on | Why it matters now | Current action |
| --- | --- | --- | --- | --- |
| P1 | Stabilize operator-facing documentation contract | none | Prevent workflow drift and reduce re-orientation cost after context loss or agent handoff. | In progress: formal `NorthStar/State/Readiness/Roadmap` docs exist, `_workflow` directory maps were expanded, and new workflow packages must keep this layer synchronized with the current smoke baseline and connector/runtime truth. |
| P2 | Expand `DIRECTORY` coverage to remaining high-churn directories | P1 | Repo orientation is still incomplete without directory-level functional maps. | Continue only for operational directories with real churn or handoff cost; avoid repo-wide documentation sprawl. |
| P3 | Keep OAuth21 durable-state hygiene on an explicit control-plane path | stable OAuth21 auth, bounded prune package, operator-facing docs | Prevent stale durable OAuth state from drifting back into ad hoc manual handling or hidden runtime behavior. | Keep `Status/Plan/Execute/Rollback` explicit and approval-gated; do not auto-wire apply into runtime. |
| P4 | Compare real client behavior against live authenticated observability | live-loaded observability package, stable OAuth21 auth, and confirmed local authenticated probe | Fresh runtime evidence should compare sent request, interpreted message, and emitted response, not just one side. | Focus on real Codex/OpenAI `initialize` compatibility paths, not more synthetic local probes. |
| P5 | Revalidate connector-visible authenticated surface from fresh client truth when needed | stable OAuth21 auth and callable connector | Repo/runtime truth already says `69`; model-runtime callability is confirmed again, but UI truth must still be refreshed only when materially needed. | Keep as targeted verification, not as default churn, and keep callable-runtime evidence separate from UI enumeration evidence. |
| P6 | Continue initialize-compatibility / retirement evidence track | stable `/mcp` route and current auth/runtime truth | This is the main protocol debt gate between current state and the target contract. | Preserve bounded compatibility while gathering/maintaining real client evidence; current Codex client evidence still blocks retirement at the entry path. |
| P7 | Decide future of session-bound outbound/sampling helper layer | explicit scoped helper debt | The scope is now known; future work should be an intentional package, not rediscovery. | Hold until it becomes the highest-leverage bounded cleanup. |

## Deferred until justified

- Automatic connector refresh routines
- Runtime/auth changes that are not backed by a current problem statement
- Broad repo-wide documentation churn without a bounded guard

## Operating rule

When priorities conflict, prefer:

1. truth preservation
2. workflow hygiene
3. bounded verification
4. feature development
