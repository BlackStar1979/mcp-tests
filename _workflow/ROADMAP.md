# Roadmap

Status: active dependency-aware roadmap
Updated: 2026-07-16

## Purpose

Maintain the current prioritized work queue in an operator-facing format that is easier to audit than scattered TODO notes.

This roadmap must stay downstream from `READINESS.md`.
`READINESS.md` decides component maturity and blockers.
`ROADMAP.md` decides the currently preferred execution order.

## Priority matrix

| Priority | Item | Depends on | Why it matters now | Current action |
| --- | --- | --- | --- | --- |
| P1 | Keep the documentation contract execution-grade | none | Prevent workflow drift and reduce re-orientation cost after context loss or agent handoff. | In progress: `NorthStar/State/Readiness/Roadmap` exist, new workflow packages must keep this layer synchronized with the current smoke baseline and connector/runtime truth, and `READINESS` plus `ROADMAP` must keep the next bounded package inferable without operator intervention. |
| P2 | Compare real client behavior against live authenticated observability | stable OAuth21 auth, live-loaded observability package, confirmed local authenticated probe | This is the shortest path to higher-confidence `initialize` retirement evidence. | Focus on real Codex/OpenAI `initialize` compatibility paths, not more synthetic local probes. |
| P3 | Continue initialize-compatibility / retirement evidence track | P2 plus stable `/mcp` route and current auth/runtime truth | This remains the main protocol debt gate between current state and the target contract. | Preserve bounded compatibility while gathering and maintaining real client evidence; current Codex client evidence still blocks retirement at the entry path. |
| P4 | Revalidate connector-visible authenticated surface from fresh client truth when needed | stable OAuth21 auth and callable connector | Repo/runtime truth already says `69`; model-runtime callability is confirmed again, but UI truth must still be refreshed only when materially needed. | Keep as targeted verification, not as default churn, and keep callable-runtime evidence separate from UI enumeration evidence. |
| P5 | Expand `DIRECTORY` coverage to remaining high-churn directories | P1 | Repo orientation is still incomplete without directory-level functional maps. | Continue only for operational directories with real churn or handoff cost; avoid repo-wide documentation sprawl. |
| P6 | Keep OAuth21 runtime hardening bounded and explicit | stable OAuth21 auth, bounded prune package, operator-facing docs | Prevent stale durable OAuth state, public-route abuse, or unbounded DCR registry growth from drifting back into hidden runtime behavior. | Keep `Status/Plan/Execute/Rollback` explicit, keep public-route throttles, body guards, and registry-capacity guards covered by smoke tests, and do not auto-wire prune apply into runtime. |
| P7 | Decide future of session-bound outbound/sampling helper layer | explicit scoped helper debt | The scope is now known; future work should be an intentional package, not rediscovery. | Hold until it becomes the highest-leverage bounded cleanup. |

## Deferred until justified

- Automatic connector refresh routines
- Runtime/auth changes that are not backed by a current problem statement
- Broad repo-wide documentation churn without a bounded guard

## Operating rule

When priorities conflict, prefer:

1. truth preservation
2. workflow hygiene
3. blocker removal for higher-readiness components
4. bounded verification
5. feature development
