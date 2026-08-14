# Roadmap

Status: active dependency-aware roadmap
Updated: 2026-08-14

## Purpose

Maintain the current prioritized work queue in an operator-facing format that is easier to audit than scattered TODO notes.

This roadmap must stay downstream from `READINESS.md`.
`READINESS.md` decides component maturity and blockers.
`ROADMAP.md` decides the currently preferred execution order.

Current derivation:

- The hardened CBM v0.9.0, canonical PKCE behavior, durable process lifecycle, and structured file subsystem are live in the current `98`-tool runtime; all fifteen `cbm_*` tools and verified snippet source-integrity recovery are unchanged.
- `MEM-1` is 4/4 and accepted at `server_start_id = 2026-08-01T18:52:13.024Z`: protected token-file auth and explicit egress are live, EN-to-PL and PL-to-EN probes rank the intended entries first, controlled token-file loss preserves lexical fallback, the ranking-noise defect is regression-guarded, and all `67` active unique memories are cached without plaintext.
- Stdin native transport, normalized `detect_changes`, explicit `detect_changes` partial-result metadata, explicit `ingest_traces` runtime-edge status, semantic-only `search_graph` structural-result suppression, source-bearing excluded-route warnings, Windows non-ASCII and whitespace path/project caveats, unsupported Cypher shape caveats, resident-set discovery guidance, fail-fast startup configuration, portable executable resolution, ADR snapshot gating, native-cache schema repair, shared OAuth/HTTP helpers, and CBM-vs-knowledge-index skill routing are live and verified in repo tests and connector probes.
- Manual CBM bridge stress now covers both default and large `_repos_with_code_samples` sets. The latest strict default run recorded `663` exact calls across all fifteen `cbm_*` tools, including lifecycle index/delete coverage, with `instability=[]`; earlier large-repo stress also stayed stable. Volatile native `search took <ms>` warnings are filtered from stable `cbm_search_code` result signatures.
- Earlier post-refresh destructive verification returned `deleted`, then `cbm_project_not_found` through a fresh `state_handle`; the source fixture remained intact. The snippet-integrity package is live and required no connector refresh.
- `COMP-1` is 3/4: official `@modelcontextprotocol/client@2.0.0` regression proves legacy, automatic modern, and pinned `2026-07-28` operation, but the August 2 operational `codex-mcp-client 0.146.0-alpha.9.2` sample still contains `2` matching legacy `initialize` entries and `0` `server/discover` entries.
- `DOC-2A` remains the autonomous fallback class, but the current July 29 pass closed the active documentation gap: `docs/superpowers`, `docs/superpowers/plans`, and `docs/superpowers/specs` now have generator-owned maps, and `scripts/audit_directory_docs.js` reports no missing maps among the top 25 dirs with churn >= 5.
- `RETR-1` retrieval now exposes workflow facts directly, rejects silent staleness, parses complete canonical workflow documents through a bounded transient sample, and ranks authoritative current evidence ahead of historical records. The refreshed live v3 knowledge index contains `279` documents, visited `1207` files and `51` directories, reports freshness `fresh`, extracts all `14` readiness components, and links all `36` source-of-truth documents.
- `UPSTREAM-PATTERN-LAB` now keeps a seven-repo local extraction corpus and records implementation signals plus transplant candidates before future retrieval/memory behavior is adopted.
- OAuth21 startup maintenance is live at `server_start_id = 2026-07-29T19:28:19.541Z`: it is transaction-coordinated before RAM load, backup/receipt guarded, daily bounded, and live passes found no eligible clients or orphan tokens without interrupting connector callability.
- Descriptor refresh review is closed: runtime `2026-08-01T19:48:43.083Z` serves the intentional additive retrieval output contract with combined fingerprint `73c0bc08dad53e8c`; live retrieval calls succeeded without OAuth relogin.
- The shared task queue lifecycle repair is live: `memory_update_task` appends provenance-bearing snapshots and `memory_get_tasks` resolves the latest snapshot per task. Connector re-enumeration is complete at `98` tools without OAuth relogin.
- `PROC-1B` is live and accepted: jobs and transitions are durable in owner-scoped SQLite, terminal status/output survive restart, unclean orphans become `interrupted`, policy failures are controlled responses, and the `py`/PowerShell resolver defects from external stress testing are repaired. Follow-up `PROC-1B-R1` adds renewable instance leases and periodic reconciliation so PID reuse cannot preserve a crashed job indefinitely. The same live job survived the second controlled restart with status and output intact.
- `MCP-TASKS-PROCESS-ADAPTER` is repo-complete on clean history: negotiated modern `run_process` calls use the same durable process registry, `tasks/get/update/cancel` are owner-bound, `tasks/list` is absent, task results survive registry reopen, raw argv is redacted, and full `7 + 294` plus clean-tree validation passed. This package is not yet live-loaded on OAuth21 `3008`; the connector-visible 98-tool fingerprint remains unchanged.
- The active autonomous quality package is persisted as task `a6cf7cac-ba33-427f-bd14-70107c36f2ef`: build an operational E2E coverage matrix across restart, reconnect, cancellation, timeout, Cloudflare Tunnel, SFTP, network, process, and destructive rollback behavior, then close the highest-risk reproduced gaps.
- `OPS-1A` is complete at `3/4`: the classified matrix and bounded runner produced `56/56` green invocations. Live SFTP remains externally blocked by a missing config, while full OAuth reconnect remains operator-driven; neither boundary is represented as automated proof.

## Priority matrix

| Priority | Item | Depends on | Why it matters now | Current action |
| --- | --- | --- | --- | --- |
| P0 | MCP Tasks process adapter — complete in repo | accepted `PROC-1B-R2`, negotiated task capability | Standard Tasks now reuse one execution truth rather than creating another scheduler/store. | Preserve as regression evidence; perform a controlled live load/probe only when runtime deployment is intentionally authorized. |
| P1 | Add bounded W3C Trace Context correlation — active | durable task/execution identity | Request, execution, task, artifact, and receipt need one safe correlation spine before artifact schemas harden. | Validate `traceparent`; persist extracted correlation only; bound or omit raw `tracestate` and `baggage`. |
| P2 | Add owner-bound process output artifacts | durable execution plus tracing contract | Large terminal output needs immutable, rediscoverable artifacts without expanding `resources/list`. | Use opaque `resource_link` handles and a bounded chunk reader; do not rely on `resources/read` as a cursor protocol. |
| P3 | Implement CIMD as an isolated SSRF-hardened compatibility package | stable Tasks/artifacts/tracing | DCR is deprecated but still required for real clients; CIMD adds remote metadata fetching and a new security boundary. | Require HTTPS, DNS/IP/redirect revalidation, private-address denial, bounded size/time, validation, cache policy, and separate adversarial fixtures. |
| P4 | Add the MRTR conformance fixture | stable protocol adapters | MRTR is useful conformance evidence but should not complicate the execution foundation. | Keep it fixture-scoped and resolve required pre-task interaction synchronously. |
| P5 | Refresh `COMP-1A` only on newer external client traffic | fresh evidence after the 2026-08-02 sample | Official SDK and server-side final-era support are complete, but the last measured operational Codex client used legacy `initialize`. | Preserve both version-gated paths unless a newer client entry sample changes the verdict. |
| P6 | Execute `OPS-1B` only when a live boundary becomes available | completed `OPS-1A`, recovered SFTP config or real reconnect event | The remaining gaps require external infrastructure or operator credential entry and must not be fabricated. | Run the existing bounded matrix against the newly available boundary and repair only reproduced defects. |

## Bounded package queue

0. `TRACE-CONTEXT` — active protocol package
   Establish bounded W3C request/execution/task correlation without using trace metadata for authorization and without persisting raw baggage.

1. `PROCESS-ARTIFACTS`
   Add owner-bound immutable output artifacts with opaque resource links and bounded reads on top of the correlation contract.

2. `CIMD` / `MRTR`
   Add current-protocol compatibility only with the explicit SSRF and fixture boundaries above.

3. `COMP-1A` / `OPS-1B` / `DOC-2A`
   Preserve as event-gated or bounded fallback work; they do not block the internally actionable protocol queue.

Completed repair chain: `CBM-ADR-REPAIR`, `OAUTH-DUPLICATE-HELPER-REVIEW`, and `FINAL-LIVE-LOAD`.
Completed official client interoperability: `MCP-OFFICIAL-SDK-V2-INTEROP` pins `@modelcontextprotocol/client@2.0.0` for tests and guards default legacy, automatic modern, pinned modern, full OAuth21 DCR/PKCE/callback/refresh behavior, process-restart recovery from SQLite, authorized list/call, and server-side evidence without touching production runtime.
Completed memory activation: `MEM-1-LIVE` activated OVH `bge-m3`, fixed live ranking noise, proved PL/EN and fallback behavior, verified a non-plaintext cache, and backfilled all active unique memories.
Completed stress closeout: `CBM-BRIDGE-SAMPLE-STRESS`; live partial-result metadata is now guarded in `_tests/smoke_cbm_live_bridge_stress.js` and agent-facing CBM interpretation guidance is guarded by `_tests/smoke_cbm_agent_skill.js`.
Completed documentation fallback: `DOC-2A` refreshed the high-churn `_workflow/operator_decisions` map and project-local `using-codebase-memory` skill maps on July 28, 2026, then added generator-owned `docs/superpowers` plan/spec maps and raised the audit guard to top25/churn>=5 on July 29, 2026 without widening into repo-wide documentation churn.
Completed upstream review extension: `CBM-UPSTREAM-201-277` records the remaining July 29, 2026 open-issue batch and updates the project-local skill boundary so documentation/workflow retrieval uses `workbench` `profile=knowledge` while CBM remains the indexed code graph.
Completed retrieval quality pass: `RETR-1-ACTIVE-WORKFLOW-RANKING` guards that active workflow documents outrank historical decision records for natural planning questions in `search_index`, `search_index_context`, and `collect_context`; live `workbench` validation after restart `manual-1785343566402` confirms the same behavior on the running connector.
Completed process execution: `PROC-1A` introduced the shared hardened sync/async core; `PROC-1B` adds durable recovery, rediscovery/history, controlled errors, and resolver fixes. Restarts `manual-1786291985998` and `manual-1786292134573` loaded the `91`-tool runtime and proved same-job terminal status/output recovery without OAuth relogin.
Completed execution identity: `PROC-1B-R2` adds transactional owner-scoped `process_start` idempotency before spawn. Full `7 + 291`, direct same-key/conflict probes, and restart recovery of job `1121654d-5016-4cac-84e3-30b4d69630de` are green at fingerprint `ec7d3af5b4ea17f5`.
Completed MCP Tasks foundation: `MCP-TASKS-PROCESS-ADAPTER` exposes negotiated `run_process` Tasks over the same registry, preserves `process_start` as the custom async surface, guards restart/owner semantics in `_tests/smoke_mcp_tasks_process_adapter.js`, and passed clean-history full `7 + 294` validation without changing the 98-tool connector fingerprint. Runtime `3008` remains intentionally not reloaded for this repo-only closeout.
Completed structured file operations: `FILE-1` adds bounded inspection, owner-bound durable staging, exact hash-preconditioned transforms, source-preserving split/merge, and heading-aware Markdown mutation. Restart `manual-1786646699884` loaded the corrected non-destructive policy; live preview/commit E2E proved staged append, section replacement, three-part split, and byte-identical merge.
Completed operational E2E package: `OPS-1A` classifies eight risk families, adds a bounded hermetic/live runner, prevents server-dependent network tests from being run as standalone evidence, and records `56/56` green invocations in `_workflow/operator_decisions/ops_1a_operational_e2e_closeout.md`.
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
