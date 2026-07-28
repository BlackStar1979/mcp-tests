# Roadmap

Status: active dependency-aware roadmap
Updated: 2026-07-28

## Purpose

Maintain the current prioritized work queue in an operator-facing format that is easier to audit than scattered TODO notes.

This roadmap must stay downstream from `READINESS.md`.
`READINESS.md` decides component maturity and blockers.
`ROADMAP.md` decides the currently preferred execution order.

Current derivation:

- The hardened CBM v0.9.0 runtime is live at `server_start_id = 2026-07-28T16:05:12.562Z` with `84` tools, fifteen `cbm_*` tools, and unchanged connector-visible surface.
- Stdin native transport, normalized `detect_changes`, explicit `detect_changes` partial-result metadata, explicit `ingest_traces` runtime-edge status, semantic-only `search_graph` structural-result suppression, source-bearing excluded-route warnings, Windows non-ASCII and whitespace path/project caveats, unsupported Cypher shape caveats, resident-set discovery guidance, fail-fast startup configuration, portable executable resolution, ADR snapshot gating, native-cache schema repair, and shared OAuth/HTTP helpers are live and verified in repo tests and connector probes.
- Manual CBM bridge stress now covers both default and large `_repos_with_code_samples` sets. The latest strict default run recorded `663` exact calls across all fifteen `cbm_*` tools, including lifecycle index/delete coverage, with `instability=[]`; earlier large-repo stress also stayed stable. Volatile native `search took <ms>` warnings are filtered from stable `cbm_search_code` result signatures.
- Post-refresh destructive verification returned `deleted`, then `cbm_project_not_found` through a fresh `state_handle`; the source fixture remained intact. No restart or connector refresh remains pending.
- `COMP-1A` remains the highest-leverage protocol package, but it is event-gated again after the July 27 `openai-mcp 1.0.0` window confirmed `8` successful legacy `initialize` responses and `0` `server/discover` entries on the explicit live server identity.
- `DOC-2A` is the only autonomous fallback and must remain bounded to a real high-churn orientation gap.

## Priority matrix

| Priority | Item | Depends on | Why it matters now | Current action |
| --- | --- | --- | --- | --- |
| P0 | Refresh `COMP-1A` only on newer external client traffic | fresh evidence after 2026-07-27 | Legacy `initialize` retirement is the highest-leverage remaining protocol gate, but the fresh July 27 operational window still blocks retirement. | Keep compatibility steady and wait for traffic newer than the current `openai-mcp 1.0.0` evidence. |
| P1 | Execute one bounded `DOC-2A` fallback only when a real orientation gap exists | P0 externally blocked | Documentation maintenance may reduce future handoff cost without fabricating protocol evidence. | Close one current high-churn directory-map gap, then stop. |
| P2 | Preserve the hardened CBM and 84-tool surface | stable live runtime | The repaired bridge, indexes, connector identity, manual multi-repo stress harness, and upstream issue reviews through ordinal 200 are now production support truth. | Reopen CBM work only on a reproduced regression, a failed stress run, a new upstream issue batch with local impact, or an approved capability change. |
| P3 | Execute `COMP-1B` only if `COMP-1A` changes the blocker shape | P0 | Retirement-decision work is useful only when fresh evidence narrows the client boundary. | Preserve bounded compatibility until a real decision delta exists. |
| P4 | Execute `SURF-1A` only when UI-visible truth changes the decision | stable live connector | UI truth remains a separate layer and should not become default churn. | Use only when it materially changes a protocol or deployment decision. |
| P5 | Keep OAuth21 runtime hardening bounded and explicit | stable OAuth21 auth | Prevent durable-state or public-route controls from drifting back into hidden behavior. | Retain smoke coverage and explicit apply/rollback boundaries. |

## Bounded package queue

0. `COMP-1A` — event-gated current course
   Re-run the operational client-entry picture only when a meaningfully new external-client evidence window exists.

1. `DOC-2A` — bounded fallback
   Execute only when one real current high-churn orientation gap can be closed without repo-wide documentation churn.

2. `COMP-1B` / `SURF-1A`
   Execute only when fresh `COMP-1A` or UI evidence materially changes the decision surface.

Completed repair chain: `CBM-ADR-REPAIR`, `OAUTH-DUPLICATE-HELPER-REVIEW`, and `FINAL-LIVE-LOAD`.
Completed stress closeout: `CBM-BRIDGE-SAMPLE-STRESS`; live partial-result metadata is now guarded in `_tests/smoke_cbm_live_bridge_stress.js` and agent-facing CBM interpretation guidance is guarded by `_tests/smoke_cbm_agent_skill.js`.

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
