# Roadmap

Status: active dependency-aware roadmap
Updated: 2026-08-02

## Purpose

Maintain the current prioritized work queue in an operator-facing format that is easier to audit than scattered TODO notes.

This roadmap must stay downstream from `READINESS.md`.
`READINESS.md` decides component maturity and blockers.
`ROADMAP.md` decides the currently preferred execution order.

Current derivation:

- The hardened CBM v0.9.0 and canonical PKCE runtime is live at `server_start_id = 2026-07-29T18:21:15.570Z` with `84` tools, fifteen `cbm_*` tools, unchanged connector-visible surface, and verified snippet source-integrity recovery.
- `MEM-1` is 4/4 and accepted at `server_start_id = 2026-08-01T18:52:13.024Z`: protected token-file auth and explicit egress are live, EN-to-PL and PL-to-EN probes rank the intended entries first, controlled token-file loss preserves lexical fallback, the ranking-noise defect is regression-guarded, and all `67` active unique memories are cached without plaintext.
- Stdin native transport, normalized `detect_changes`, explicit `detect_changes` partial-result metadata, explicit `ingest_traces` runtime-edge status, semantic-only `search_graph` structural-result suppression, source-bearing excluded-route warnings, Windows non-ASCII and whitespace path/project caveats, unsupported Cypher shape caveats, resident-set discovery guidance, fail-fast startup configuration, portable executable resolution, ADR snapshot gating, native-cache schema repair, shared OAuth/HTTP helpers, and CBM-vs-knowledge-index skill routing are live and verified in repo tests and connector probes.
- Manual CBM bridge stress now covers both default and large `_repos_with_code_samples` sets. The latest strict default run recorded `663` exact calls across all fifteen `cbm_*` tools, including lifecycle index/delete coverage, with `instability=[]`; earlier large-repo stress also stayed stable. Volatile native `search took <ms>` warnings are filtered from stable `cbm_search_code` result signatures.
- Earlier post-refresh destructive verification returned `deleted`, then `cbm_project_not_found` through a fresh `state_handle`; the source fixture remained intact. The snippet-integrity package is live and required no connector refresh.
- `COMP-1` is 3/4: official `@modelcontextprotocol/client@2.0.0` regression proves legacy, automatic modern, and pinned `2026-07-28` operation, but the August 2 operational `codex-mcp-client 0.146.0-alpha.9.2` sample still contains `2` matching legacy `initialize` entries and `0` `server/discover` entries.
- `DOC-2A` remains the autonomous fallback class, but the current July 29 pass closed the active documentation gap: `docs/superpowers`, `docs/superpowers/plans`, and `docs/superpowers/specs` now have generator-owned maps, and `scripts/audit_directory_docs.js` reports no missing maps among the top 25 dirs with churn >= 5.
- `RETR-1` retrieval now exposes workflow facts directly, rejects silent staleness, parses complete canonical workflow documents through a bounded transient sample, and ranks authoritative current evidence ahead of historical records. The live v3 knowledge index contains `261` documents, visited `1127` files and `50` directories, reports freshness `fresh`, extracts all `11` readiness components, and links all `36` source-of-truth documents.
- `UPSTREAM-PATTERN-LAB` now keeps a seven-repo local extraction corpus and records implementation signals plus transplant candidates before future retrieval/memory behavior is adopted.
- OAuth21 startup maintenance is live at `server_start_id = 2026-07-29T19:28:19.541Z`: it is transaction-coordinated before RAM load, backup/receipt guarded, daily bounded, and live passes found no eligible clients or orphan tokens without interrupting connector callability.
- Descriptor refresh review is closed: runtime `2026-08-01T19:48:43.083Z` serves the intentional additive retrieval output contract with combined fingerprint `73c0bc08dad53e8c`; live retrieval calls succeeded without OAuth relogin.

## Priority matrix

| Priority | Item | Depends on | Why it matters now | Current action |
| --- | --- | --- | --- | --- |
| P0 | Refresh `COMP-1A` only on newer external client traffic | fresh evidence after the 2026-08-02 sample | Official SDK and server-side final-era support are complete, but operational Codex still uses legacy `initialize`. | Preserve both version-gated paths and wait for a newer Codex client entry sample. |
| P1 | Execute one bounded `DOC-2A` fallback only when a real orientation gap exists | P0 externally blocked | Documentation maintenance may reduce future handoff cost without fabricating protocol evidence. | Current top25/churn>=5 audit is clean; rerun `scripts/audit_directory_docs.js` before any further directory-map work. |
| P2 | Preserve accepted `MEM-1` behavior | live provider and complete cache | Cross-language memory retrieval is now a production support layer rather than an activation task. | Reopen only on a measured ranking, provider, cache, confidentiality, or fallback regression. |
| P3 | Preserve the hardened CBM and 84-tool surface | stable live runtime | The repaired bridge, indexes, connector identity, manual multi-repo stress harness, upstream issue reviews through ordinal 277, and snippet source-integrity recovery are production support truth. | Reopen CBM work only on a reproduced regression, failed stress run, new upstream issue with local impact, or approved capability change. |
| P4 | Execute `COMP-1B` only if `COMP-1A` changes the blocker shape | P0 | Retirement-decision work is useful only when fresh evidence narrows the client boundary. | Preserve bounded compatibility until a real decision delta exists. |
| P5 | Execute `SURF-1A` only when UI-visible truth changes the decision | stable live connector | UI truth remains a separate layer and should not become default churn. | Use only when it materially changes a protocol or deployment decision. |
| P6 | Hold OAuth21 runtime hardening steady | live PKCE and startup-prune validation | Prevent stable auth from becoming a source of speculative churn. | Preserve PKCE, durable-state, startup-prune, backup, and audit guards; reopen only on reproduced evidence or a current standards delta. |

## Bounded package queue

0. `COMP-1A` — event-gated protocol course
   Re-run the operational client-entry picture only when a meaningfully new external-client evidence window exists.

1. `DOC-2A` — bounded fallback
   Execute only when one real current high-churn orientation gap can be closed without repo-wide documentation churn.

2. `COMP-1B` / `SURF-1A`
   Execute only when fresh `COMP-1A` or UI evidence materially changes the decision surface.

Completed repair chain: `CBM-ADR-REPAIR`, `OAUTH-DUPLICATE-HELPER-REVIEW`, and `FINAL-LIVE-LOAD`.
Completed official client interoperability: `MCP-OFFICIAL-SDK-V2-INTEROP` pins `@modelcontextprotocol/client@2.0.0` for tests and guards default legacy, automatic modern, pinned modern, full OAuth21 DCR/PKCE/callback/refresh behavior, process-restart recovery from SQLite, authorized list/call, and server-side evidence without touching production runtime.
Completed memory activation: `MEM-1-LIVE` activated OVH `bge-m3`, fixed live ranking noise, proved PL/EN and fallback behavior, verified a non-plaintext cache, and backfilled all active unique memories.
Completed stress closeout: `CBM-BRIDGE-SAMPLE-STRESS`; live partial-result metadata is now guarded in `_tests/smoke_cbm_live_bridge_stress.js` and agent-facing CBM interpretation guidance is guarded by `_tests/smoke_cbm_agent_skill.js`.
Completed documentation fallback: `DOC-2A` refreshed the high-churn `_workflow/operator_decisions` map and project-local `using-codebase-memory` skill maps on July 28, 2026, then added generator-owned `docs/superpowers` plan/spec maps and raised the audit guard to top25/churn>=5 on July 29, 2026 without widening into repo-wide documentation churn.
Completed upstream review extension: `CBM-UPSTREAM-201-277` records the remaining July 29, 2026 open-issue batch and updates the project-local skill boundary so documentation/workflow retrieval uses `workbench` `profile=knowledge` while CBM remains the indexed code graph.
Completed retrieval quality pass: `RETR-1-ACTIVE-WORKFLOW-RANKING` guards that active workflow documents outrank historical decision records for natural planning questions in `search_index`, `search_index_context`, and `collect_context`; live `workbench` validation after restart `manual-1785343566402` confirms the same behavior on the running connector.
Completed structural document graph pass: `RETR-1-DOCUMENT-GRAPH` exposes deterministic document-link topology in `knowledge_summary.document_graph`; the latest July 29 validation reports `252` docs, `514` internal document links, all `36` source-of-truth docs linked, and `40` unresolved-reference samples after wildcard/glob noise filtering.
Completed measured retrieval regression: `RETR-1-QUALITY-REGRESSION` adds source-snapshot freshness, complete bounded canonical extraction, robust Markdown table parsing, identifier-aware ranking, and proof-over-audit ordering. Unit, schema, full-suite, restart, and live acceptance evidence are recorded in `_workflow/operator_decisions/retr_1_quality_regression_closeout.md`.
Completed upstream pattern lab pass: `UPSTREAM-PATTERN-LAB` clones or reuses seven local high-value retrieval/memory repositories under the ignored `_repos_with_code_samples` corpus, extracts observable implementation signals with `scripts/extract_upstream_repo_patterns.js`, writes `docs/UPSTREAM_REPO_PATTERN_LAB.md`, and guards the extractor with `_tests/smoke_upstream_repo_pattern_extractor.js`.
Completed upstream second pass and `CBM-SNIPPET-INTEGRITY`: the extractor now pins nested Git revisions, separates tests from production source, records package/dependency cost, ranks implementation definitions over wrappers, and emits explicit adoption/defer decisions. The same investigation reproduced a native `get_code_snippet` symbol-span mismatch after reindexing; the bridge now validates symbol presence and performs bounded workspace-backed recovery or marks source unreliable. Restart `manual-1785348037500` loaded the package, and the live connector returned corrected lines `1073-1084` with native lines `898-909` preserved.

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
