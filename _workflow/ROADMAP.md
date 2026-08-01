# Roadmap

Status: active dependency-aware roadmap
Updated: 2026-08-01

## Purpose

Maintain the current prioritized work queue in an operator-facing format that is easier to audit than scattered TODO notes.

This roadmap must stay downstream from `READINESS.md`.
`READINESS.md` decides component maturity and blockers.
`ROADMAP.md` decides the currently preferred execution order.

Current derivation:

- The hardened CBM v0.9.0 and canonical PKCE runtime is live at `server_start_id = 2026-07-29T18:21:15.570Z` with `84` tools, fifteen `cbm_*` tools, unchanged connector-visible surface, and verified snippet source-integrity recovery.
- `MEM-1` is secret-file-ready and live-loaded: file/legacy token conflicts fail closed, supervisors carry explicit activation settings, provisioning applies a restricted ACL, and PID `3804` remains safely keyword-only. Runtime activation now depends only on the real operator-owned credential and live PL/EN quality evidence.
- Stdin native transport, normalized `detect_changes`, explicit `detect_changes` partial-result metadata, explicit `ingest_traces` runtime-edge status, semantic-only `search_graph` structural-result suppression, source-bearing excluded-route warnings, Windows non-ASCII and whitespace path/project caveats, unsupported Cypher shape caveats, resident-set discovery guidance, fail-fast startup configuration, portable executable resolution, ADR snapshot gating, native-cache schema repair, shared OAuth/HTTP helpers, and CBM-vs-knowledge-index skill routing are live and verified in repo tests and connector probes.
- Manual CBM bridge stress now covers both default and large `_repos_with_code_samples` sets. The latest strict default run recorded `663` exact calls across all fifteen `cbm_*` tools, including lifecycle index/delete coverage, with `instability=[]`; earlier large-repo stress also stayed stable. Volatile native `search took <ms>` warnings are filtered from stable `cbm_search_code` result signatures.
- Earlier post-refresh destructive verification returned `deleted`, then `cbm_project_not_found` through a fresh `state_handle`; the source fixture remained intact. The snippet-integrity package is live and required no connector refresh.
- `COMP-1A` remains the highest-leverage protocol package, but it is event-gated again after the July 28 `codex-mcp-client 0.146.0-alpha.3.1` latest-entry window confirmed `2` successful legacy `initialize` responses and `0` `server/discover` entries; the latest runtime start itself currently contains follow-up traffic only and must be treated as stale for entry-path purposes.
- `DOC-2A` remains the autonomous fallback class, but the current July 29 pass closed the active documentation gap: `docs/superpowers`, `docs/superpowers/plans`, and `docs/superpowers/specs` now have generator-owned maps, and `scripts/audit_directory_docs.js` reports no missing maps among the top 25 dirs with churn >= 5.
- `RETR-1` retrieval now exposes workflow facts directly, ranks active workflow truth ahead of historical decision records for natural planning questions, and includes a deterministic document graph for internal doc references. The graph is intentionally local and dependency-free: it maps Markdown/backtick document references, linked-node coverage, active entrypoint outgoing links, top linked docs, and unresolved-reference samples without adding vector databases or LLM-based extraction.
- `UPSTREAM-PATTERN-LAB` now keeps a seven-repo local extraction corpus and records implementation signals plus transplant candidates before future retrieval/memory behavior is adopted.
- OAuth21 startup maintenance is live at `server_start_id = 2026-07-29T19:28:19.541Z`: it is transaction-coordinated before RAM load, backup/receipt guarded, daily bounded, and live passes found no eligible clients or orphan tokens without interrupting connector callability.
- Descriptor refresh review is closed: current Codex fetched the current 84-tool descriptor fingerprint twice on runtime `2026-08-01T17:51:19.986Z`, and no manual remove/add or OAuth relogin is required.

## Priority matrix

| Priority | Item | Depends on | Why it matters now | Current action |
| --- | --- | --- | --- | --- |
| P0 | Activate and validate `MEM-1` | operator-owned OVH token plus explicit egress opt-in | The secret-file path is live and tested; only credential provisioning and measurable retrieval quality remain. | Provision through the restricted-ACL helper, take over the supervisor with explicit settings, require `activation_ready=true`, run bounded PL/EN related/unrelated probes, and retain keyword fallback unless acceptance evidence passes. |
| P1 | Refresh `COMP-1A` only on newer external client traffic | fresh evidence after 2026-07-28 | Legacy `initialize` retirement is the highest-leverage protocol gate, but the fresh July 28 operational entry window still blocks retirement. | Keep compatibility steady and wait for traffic newer than the current `codex-mcp-client 0.146.0-alpha.3.1` evidence. |
| P2 | Execute one bounded `DOC-2A` fallback only when a real orientation gap exists | P1 externally blocked | Documentation maintenance may reduce future handoff cost without fabricating protocol evidence. | Current top25/churn>=5 audit is clean; rerun `scripts/audit_directory_docs.js` before any further directory-map work. |
| P3 | Preserve the hardened CBM and 84-tool surface | stable live runtime | The repaired bridge, indexes, connector identity, manual multi-repo stress harness, upstream issue reviews through ordinal 277, and snippet source-integrity recovery are production support truth. | Reopen CBM work only on a reproduced regression, failed stress run, new upstream issue with local impact, or approved capability change. |
| P4 | Execute `COMP-1B` only if `COMP-1A` changes the blocker shape | P1 | Retirement-decision work is useful only when fresh evidence narrows the client boundary. | Preserve bounded compatibility until a real decision delta exists. |
| P5 | Execute `SURF-1A` only when UI-visible truth changes the decision | stable live connector | UI truth remains a separate layer and should not become default churn. | Use only when it materially changes a protocol or deployment decision. |
| P6 | Hold OAuth21 runtime hardening steady | live PKCE and startup-prune validation | Prevent stable auth from becoming a source of speculative churn. | Preserve PKCE, durable-state, startup-prune, backup, and audit guards; reopen only on reproduced evidence or a current standards delta. |

## Bounded package queue

0. `MEM-1-LIVE` — current course
   Configure server-owned OVH embedding access, restart, and prove PL/EN ranking plus failure fallback without exposing vectors or secrets.

1. `COMP-1A` — event-gated protocol course
   Re-run the operational client-entry picture only when a meaningfully new external-client evidence window exists.

2. `DOC-2A` — bounded fallback
   Execute only when one real current high-churn orientation gap can be closed without repo-wide documentation churn.

3. `COMP-1B` / `SURF-1A`
   Execute only when fresh `COMP-1A` or UI evidence materially changes the decision surface.

Completed repair chain: `CBM-ADR-REPAIR`, `OAUTH-DUPLICATE-HELPER-REVIEW`, and `FINAL-LIVE-LOAD`.
Completed stress closeout: `CBM-BRIDGE-SAMPLE-STRESS`; live partial-result metadata is now guarded in `_tests/smoke_cbm_live_bridge_stress.js` and agent-facing CBM interpretation guidance is guarded by `_tests/smoke_cbm_agent_skill.js`.
Completed documentation fallback: `DOC-2A` refreshed the high-churn `_workflow/operator_decisions` map and project-local `using-codebase-memory` skill maps on July 28, 2026, then added generator-owned `docs/superpowers` plan/spec maps and raised the audit guard to top25/churn>=5 on July 29, 2026 without widening into repo-wide documentation churn.
Completed upstream review extension: `CBM-UPSTREAM-201-277` records the remaining July 29, 2026 open-issue batch and updates the project-local skill boundary so documentation/workflow retrieval uses `workbench` `profile=knowledge` while CBM remains the indexed code graph.
Completed retrieval quality pass: `RETR-1-ACTIVE-WORKFLOW-RANKING` guards that active workflow documents outrank historical decision records for natural planning questions in `search_index`, `search_index_context`, and `collect_context`; live `workbench` validation after restart `manual-1785343566402` confirms the same behavior on the running connector.
Completed structural document graph pass: `RETR-1-DOCUMENT-GRAPH` exposes deterministic document-link topology in `knowledge_summary.document_graph`; the latest July 29 validation reports `252` docs, `514` internal document links, all `36` source-of-truth docs linked, and `40` unresolved-reference samples after wildcard/glob noise filtering.
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
