# Roadmap

Status: active dependency-aware roadmap
Updated: 2026-07-17

## Purpose

Maintain the current prioritized work queue in an operator-facing format that is easier to audit than scattered TODO notes.

This roadmap must stay downstream from `READINESS.md`.
`READINESS.md` decides component maturity and blockers.
`ROADMAP.md` decides the currently preferred execution order.

Current derivation:

- `DOC-1` and `OBS-1` are stable enough to support planning and diagnosis.
- `COMP-1A` remains the highest-leverage next package, and the freshest retained operational windows still show the blocker.
- `COMP-1B` is conditional, not default; it only exists if `COMP-1A` actually changes or tightens the decision surface.
- `SURF-1A` should move only when it changes the `COMP-1` decision rather than as a separate default track.
- `DOC-2A` is the fallback package only when protocol evidence is externally timing-bound.

## Priority matrix

| Priority | Item | Depends on | Why it matters now | Current action |
| --- | --- | --- | --- | --- |
| P1 | Keep the documentation contract execution-grade | none | Prevent workflow drift and reduce re-orientation cost after context loss or agent handoff. | Active rule: every workflow-changing package must keep `NorthStar/State/Readiness/Roadmap` synchronized with the current smoke baseline and connector/runtime truth, and `READINESS` must keep the next bounded package inferable without operator intervention. |
| P2 | Execute `COMP-1A`: refresh real client-entry evidence on the live authenticated route | stable OAuth21 auth, live-loaded observability package, confirmed local authenticated probe | This is the shortest path to higher-confidence `initialize` retirement evidence. | Focus on real Codex/OpenAI `initialize` compatibility paths, not more synthetic local probes. Use current-window evidence plus blocker-matrix freshness windows together when describing the blocker. This is the default next execution package while `COMP-1` stays blocked. |
| P3 | Execute `COMP-1B` only if `COMP-1A` changes the blocker shape | P2 plus stable `/mcp` route and current auth/runtime truth | This remains the main protocol debt gate between current state and the target contract, but only after fresh evidence. | Preserve bounded compatibility while gathering and maintaining real client evidence; only draft a retirement-decision delta if the current client-family evidence meaningfully changes. |
| P4 | Execute `SURF-1A` only when UI-visible truth changes the decision | stable OAuth21 auth and callable connector | Repo/runtime truth already says `69`; model-runtime callability is confirmed again, but UI truth must still be refreshed only when materially needed. | Keep as targeted verification, not as default churn, and keep callable-runtime evidence separate from UI enumeration evidence. |
| P5 | Execute `DOC-2A` only as the bounded fallback package | P1 | Repo orientation still needs selective extension, but only when higher-leverage protocol work is externally timing-bound. | Expand `DIRECTORY` coverage only for one real high-churn documentation gap and keep the next package inferable from docs alone; avoid repo-wide documentation sprawl. |
| P6 | Keep OAuth21 runtime hardening bounded and explicit | stable OAuth21 auth, bounded prune package, operator-facing docs | Prevent stale durable OAuth state, public-route abuse, or unbounded DCR registry growth from drifting back into hidden runtime behavior. | Keep `Status/Plan/Execute/Rollback` explicit, keep public-route throttles, body guards, and registry-capacity guards covered by smoke tests, and do not auto-wire prune apply into runtime. |
| P7 | Decide future of session-bound outbound/sampling helper layer | explicit scoped helper debt | The scope is now known; future work should be an intentional package, not rediscovery. | Hold until it becomes the highest-leverage bounded cleanup. |

## Bounded package queue

1. `COMP-1A`
   Refresh the current operational client-entry picture on live OAuth21 `/mcp` using retained bounded evidence, not synthetic route exercises.

2. `COMP-1B`
   Only if `COMP-1A` changes the blocker or narrows the affected client family enough to justify a retirement-decision delta.

3. `SURF-1A`
   Only if client-facing UI-visible surface truth is what still prevents the decision after `COMP-1A`.

4. `DOC-2A`
   Only if the protocol-evidence path is waiting on external timing and there is a real documentation gap worth closing meanwhile.

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
