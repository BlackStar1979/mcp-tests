# Readiness

Status: active technical component readiness report
Updated: 2026-07-28

## Purpose

Track the distance between the validated current state and the accepted NorthStar target in a form that is directly usable for autonomous planning.

This file is the execution bridge between:

- `NORTHSTAR.md` as the target contract
- `STATE.md` as the validated as-is picture
- `ROADMAP.md` as the ordered queue derived from readiness

If autonomous planning becomes ambiguous, this file decides:

- which component is actually closest to the target
- which blocker has the highest downstream leverage
- which bounded package should move next by default

## Maturity scale

- `4/4` stable for the current target and governed by specs/tests/evidence
- `3/4` strong and usable, but still carrying bounded debt or missing one important proof
- `2/4` partially aligned; meaningful blocker still controls the next step
- `1/4` scoped but not execution-ready

## Autonomous planning rule

Choose the next package by walking this order:

1. pick the highest-priority component whose blocker is still real in current evidence
2. prefer the blocker that unlocks more than one downstream component
3. prefer a package that can be bounded by smoke coverage, runtime evidence, or both
4. do not jump to a lower component only because it is easier or more available

## Component maturity

| ID | Component | Maturity | NorthStar role | Depends on | Current evidence | Main blocker | Default next bounded package | Done signal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DOC-1 | Operator-facing documentation contract | 3/4 | Keep the project operator-legible and handoff-safe | none | `NorthStar/State/Readiness/Roadmap` exist, core `DIRECTORY.md` coverage exists, and workflow docs are already smoke-guarded. | Planning still depends too much on reading several files together unless `READINESS` stays execution-grade. | Keep `READINESS`, `ROADMAP`, and the active index synchronized so the next package is inferable without operator intervention. | Next bounded package is obvious from docs alone, with no cross-reading required. |
| OBS-1 | Server-side request/response observability | 3/4 | Preserve structured, auditable runtime truth | DOC-1 | Bounded `rpc_received` and `rpc_response_sent` audit coverage exists on active `/mcp` paths, including authenticated local validation. | Observability is good enough for diagnosis, but still needs disciplined use as the source for client-entry decisions. | Use live trail evidence before adding any broader logging or diagnostics churn. | Active client-entry questions can be answered from existing bounded observability without new logging work. |
| AUTH-1 | OAuth21 authorized runtime | 3/4 | Keep the internal authorized surface production-grade and stable | DOC-1 | Resource-server identity, throttling, oversized-body aborts, bounded DCR growth, SQLite durability, and explicit prune control-plane all exist. | Stability must remain ahead of change pressure; new auth churn now has to be problem-driven. | Hold runtime auth steady and only touch auth when fresh evidence shows a real failure or gap. | Runtime auth work is driven only by a current defect or an approved target change. |
| SURF-1 | Connector-visible surface governance | 4/4 | Keep MCP-visible tools intentionally governed | DOC-1, AUTH-1 | Live and repository counts are aligned at `13 + 71 = 84`; hardened CBM v0.9.0 is live at `server_start_id = 2026-07-28T16:05:12.562Z` with all fifteen `cbm_*` tools and unchanged connector-visible surface. Post-refresh `state_handle` deletion returned `deleted`; a fresh confirmed repeat returned `cbm_project_not_found`; the fixture source directory remained intact. Full offline smoke is GREEN at `7 + 267`. | No connector-visible surface blocker remains. | Preserve the unchanged 84-tool contract and reopen surface work only on a reproduced regression or approved capability change. | Count, schemas, destructive confirmation, source safety, and cache directives remain aligned. |
| CBM-1 | Codebase-Memory bridge and index integrity | 4/4 | Keep repository analysis trustworthy and mutation-safe | DOC-1, SURF-1 | Stdin native transport, duplicate change normalization, fail-fast runtime output configuration, operator-neutral executable fallback, fail-closed ADR snapshot gating, exact OAuth/HTTP helper consolidation, and v0.9.0 cache-schema repair are live at `server_start_id = 2026-07-28T16:05:12.562Z`. All three active indexes retain their counts; `manage_adr(get)` succeeds; live `detect_changes` now exposes exact returned/omitted totals, `bridge_analysis`, and `impact_resolution_reason`; live `ingest_traces` exposes `runtime_edge_creation=not_implemented` and `runtime_edges_created=0`; semantic-only `search_graph` suppresses unfiltered structural `results`; `index_repository` warns on source-bearing excluded route directories, Windows non-ASCII paths, and whitespace paths; `search_code` warns on Windows non-ASCII patterns plus non-ASCII or whitespace project identifiers; `get_code_snippet` warns on Windows non-ASCII or whitespace project identifiers; `query_graph` warns on unsupported Cypher shapes; upstream reviews are recorded through ordinal 200; full offline smoke is GREEN at `7 + 267`. Manual multi-repo stress records exact per-tool counts: the July 28 strict default run covered `663` calls across all fifteen `cbm_*` tools, including lifecycle `index/delete`, with `instability=[]`; earlier large-repo stress also remained stable. | No active CBM integrity blocker remains. | Preserve the backup, migrator, stress harness, and upstream-issue review discipline; reopen CBM work only on a reproduced regression, failed stress run, new upstream issue batch with local impact, or approved capability change. | Live identity remains 84 tools with repaired ADR storage, explicit partial-result metadata, normalized and stable stress-tested results, and no restart or connector refresh pending. |
| COMP-1 | Legacy `initialize` retirement readiness | 2/4 | Retire the main remaining protocol-debt path safely | OBS-1, AUTH-1, SURF-1 | Repo-native no-handshake support is real. The fresh `2026-07-28` report distinguishes stale latest-runtime follow-up traffic from the latest real entry window: `--latest-entry-window` selects live `server_start_id 2026-07-28T03:49:00.666Z` and shows `initialize_only` for `codex-mcp-client 0.146.0-alpha.3.1` with `2` successful legacy `initialize` responses and `0` `server/discover` entries. Historical synthetic server starts are preserved but no longer displace the selected live window. | Real client-family entry behavior still blocks retirement. | Gather or refresh real client compatibility evidence before any retirement decision package, explicitly selecting the live server identity or the latest entry window when shared audit history contains other process starts. | A fresh operational client family proves `server/discover` entry behavior or the remaining `initialize` dependence is explicitly accepted. |
| CTRL-1 | OAuth21 durable-state hygiene control plane | 3/4 | Keep state maintenance explicit and auditable | AUTH-1, DOC-1 | Preview/receipt/gate/apply/rollback helpers and bounded records/backups exist under `_workflow/control_plane/`. | Remaining value is operational discipline, not more automation. | Keep apply explicit and operator-visible; do not auto-wire maintenance into runtime. | Maintenance remains control-plane-only and does not leak into runtime behavior. |
| DEBT-1 | Session-bound outbound/sampling helper debt | 2/4 | Close residual local-helper debt without reopening target architecture | OBS-1 | Scope is explicitly recorded as bounded helper debt, not active route architecture. | No evidence yet that removing it outranks client-entry compatibility work. | Leave deferred until it blocks a higher-priority component or creates measurable execution drag. | Future work is either an intentional cleanup package or an explicit retention decision. |
| DOC-2 | Directory-level functional orientation | 2/4 | Make every high-value area self-describing for handoff/restart continuity | DOC-1 | Core operational directories, the high-churn CBM integration boundary, the high-churn `_workflow/operator_decisions` ledger, and the project-local `using-codebase-memory` skill boundary now have generator-owned or smoke-guarded maps. `scripts/audit_directory_docs.js` reports no missing `DIRECTORY.md` files among the top 20 tracked dirs with churn >= 7 in the last 30 days. | Repo-wide expansion would create churn unless it targets high-change directories. | Extend `DIRECTORY` coverage only where churn or handoff cost is currently real. | Remaining high-churn directories are covered without documentation sprawl. |
| RETR-1 | Workspace retrieval ergonomics | 3/4 | Reduce agent execution friction without changing product truth | DOC-1, SURF-1 | `workbench` callability and repository indexing are materially better than before. The workspace retrieval index now supports optional workspace-relative `path` build scopes; query-time path filters for `search_index`, `search_index_context`, `collect_context`, and `collect_romionsim_context`; shared retrieval output metadata (`index_scope`, `path_filter`, `index_truncated`, `index_created_at`, `index_count`); known non-authoritative bulk-folder and historical snapshot skips; and persisted scan stats including `truncated`, limits, visited counts, skipped counts, and scope. A full `C:\Work` rebuild on July 28, 2026 completed without truncation after the redesign (`19875` docs, `21005` visited files); scoped `mcp-tests` also completes without truncation (`14829` docs, `14862` visited files). Usability probes show scoped `mcp-tests` searches return the expected active files for `client_entry_path_report`, `workspace_index`, and `READINESS RETR-1`; full offline smoke is GREEN at `7 + 267` after the grouped retrieval contract update. | Retrieval quality still depends on environment freshness, JSON snapshot size, and ranking heuristics. | Keep this JSON index as a bounded retrieval helper; move to SQLite/FTS only if a single authoritative repo again exceeds scan or file-size limits or search quality needs richer ranking than path-filtered lexical retrieval. | Retrieval issues stop being a recurring blocker on active packages. |

## Dependency spine

Read the queue through this dependency spine:

1. `DOC-1` documentation contract
   - keeps orientation durable
   - makes autonomous selection trustworthy
2. `OBS-1` observability
   - provides the truth source for runtime/client interpretation
3. `AUTH-1` authorized runtime
   - remains stable while client-entry evidence is event-gated
4. `SURF-1` surface governance
   - preserves the unchanged 84-tool contract
5. `CBM-1` bridge and index integrity
   - is complete and remains a protected support layer
6. `COMP-1` initialize retirement readiness
   - is the highest-leverage remaining protocol gate, but resumes only on fresh client traffic
7. `CTRL-1`, `DEBT-1`, `DOC-2`, `RETR-1`
   - operational support tracks; `DOC-2A` is the only bounded autonomous fallback while `COMP-1A` is externally blocked

## Current blockers by leverage

1. `COMP-1`
   Real client-family entry behavior still blocks `initialize` retirement. The package is externally event-gated and must not be refreshed until new traffic creates a meaningfully new evidence window.

2. `DOC-2`
   Directory coverage remains incomplete outside normalized operational areas. This is a bounded fallback only when one current high-churn gap is demonstrable.

`CBM-1` and `SURF-1` have no active blocker. Runtime callability and UI-visible enumeration remain separate evidence layers, but the current hardened 84-tool identity is stable.

## Autonomous execution packages

Active selection is limited to event-gated `COMP-1A` and bounded fallback `DOC-2A`. Completed CBM packages remain listed as regression references, not as current queue items. Do not invent a parallel queue unless fresh evidence disproves this ordering.

| Package | Targets | Why now | Primary evidence source | Stop condition | If blocked |
| --- | --- | --- | --- | --- | --- |
| `CBM-ADR-REPAIR` | `CBM-1` | Completed regression reference. | External backup manifest, bounded migrator, `cbm_manage_adr`, `cbm_index_status`, and isolated-cache reconstruction tests | Reopen only if ADR reads, schema compatibility, or preserved counts regress. | Restore from the external checkpoint before any further cache mutation. |
| `OAUTH-DUPLICATE-HELPER-REVIEW` | `CBM-1`, `AUTH-1` | Completed regression reference. | Shared helper modules, characterization tests, OAuth/runtime smokes | Reopen only if exact helper behavior diverges or a security fix exposes a new duplicate. | Stop before semantic refactoring if equivalence cannot be proved. |
| `FINAL-LIVE-LOAD` | `CBM-1`, `SURF-1`, `AUTH-1` | Completed regression reference. | Full offline suite, self-test, restart receipt `manual-1785110528926`, refreshed connector identity, and live CBM probes | Reopen only if live identity or hardened behavior regresses. | Preserve the current runtime and restore from the existing checkpoint before new live mutation. |
| `COMP-1A` | `COMP-1`, `OBS-1` | Highest-leverage protocol gate after CBM repair closeout, but externally event-gated. | `_logs/.mcp-tests-audit.jsonl`, explicit live `server_start_id` or `--latest-entry-window`, and `_workflow/operator_decisions/initialize_client_compatibility_evidence.md` | Current operational client-family evidence is refreshed into a clear `initialize_only` or `server_discover_entry` verdict. | Fresh evidence on 2026-07-28 still shows `initialize_only` for `codex-mcp-client 0.146.0-alpha.3.1`; keep compatibility steady and wait for newer external client traffic before refreshing again. |
| `COMP-1B` | `COMP-1`, `SURF-1` | Only worth doing after `COMP-1A` narrows the blocker or changes the decision boundary. | Fresh `COMP-1A` result plus `_workflow/operator_decisions/initialize_retirement_decision_prep.md` | A bounded retirement-decision delta exists or the blocker is restated with tighter current evidence. | Fall back to `SURF-1A` only if connector/UI truth is the deciding ambiguity. |
| `SURF-1A` | `SURF-1` | Connector/UI verification matters only when it changes the protocol-debt decision. | Codex/OpenAI UI evidence, runtime callability evidence, connector-facing tool inventory evidence | UI-visible enumeration is either confirmed decision-relevant or explicitly ruled irrelevant to the current package. | Return to `COMP-1A`; do not let UI verification become autonomous churn. |
| `DOC-2A` | `DOC-1`, `DOC-2` | Safe fallback package when higher-leverage protocol evidence is externally timing-bound. | `READINESS.md`, `ROADMAP.md`, `ACTIVE_WORKFLOW_INDEX.md`, current directory maps | One real high-churn documentation gap is closed and the next bounded package remains inferable from docs alone. | Stop if the work would become repo-wide documentation sprawl instead of a bounded orientation fix. |

## Completed hardened v0.9.0 rollout

The hardened CBM v0.9.0 rollout is complete.

- Live runtime and connector: `84` tools, including fifteen `cbm_*` tools.
- Live identity: `server_start_id = 2026-07-28T16:05:12.562Z`, 84 authenticated tools, unchanged connector-visible surface.
- Live behavior: stdin native transport emits no raw-JSON deprecation warning; `detect_changes` normalizes duplicate entries; volatile native `search took <ms>` warnings no longer leak into stable `cbm_search_code` result signatures; ADR reads succeed across all three repaired indexes.
- Delete contract: `project`, `confirm`, `state_handle`; the handle remains TTL-bound, auth-bound, project-bound, one-time, and audit-redacted.
- Post-refresh outcome: disposable index deleted; repeated delete through a fresh challenge mapped to `cbm_project_not_found`; source fixture directory remained intact.
- Restart/refresh state: none pending.

## Default next package

Unless fresh evidence changes the dependency graph:

1. `COMP-1A` remains event-gated until new external client traffic creates a meaningfully new evidence window.
2. `DOC-2A` is the only bounded autonomous fallback when one real high-churn orientation gap is demonstrable.

## Latest supporting package

- `2026-07-28`: redesigned the workspace retrieval index enough to handle this restored `C:\Work` without hidden truncation and with better query usefulness. `build_index` now accepts optional workspace-relative `path` scopes; `search_index`, `search_index_context`, `collect_context`, and `collect_romionsim_context` accept optional indexed-path filters; all four read tools expose shared retrieval metadata (`index_scope`, `path_filter`, `index_truncated`, `index_created_at`, `index_count`); and both `build_index` and `index_status` return persisted scan diagnostics (`scope`, `visited_files`, `visited_dirs`, `truncated`, `max_files`, `max_dirs`, `skipped`). The scanner skips known non-authoritative bulk folders such as `_repos_with_code_samples`, `_public_sandbox`, `_backups`, `_control`, `_docs`, `_stages`, and `archive`, plus historical `_workflow/control_plane/snapshots`, `_workflow/control_plane/retired_root_backups`, and `_workflow/historical` trees. Validation: scoped `mcp-tests` build completed with `truncated=false`, `14829` docs, and `14862` visited files; full `C:\Work` build completed with `truncated=false`, `19875` docs, and `21005` visited files; after the grouped retrieval contract update, full offline smoke is GREEN at `7 + 267`. `_tests/smoke_build_index_tool.js`, `_tests/smoke_output_schema_guard.js`, and `_tests/smoke_schema_compat.js` guard the contract.
- `2026-07-28`: refreshed `COMP-1A` with the latest-entry-window path. The latest runtime slice `2026-07-28T16:05:12.562Z` is stale entry evidence, but `node _workflow/scripts/client_entry_path_report.js --latest-entry-window --client-name=codex-mcp-client --evidence-scope=operational --max-age-days=2 --limit=20` selects `server_start_id 2026-07-28T03:49:00.666Z` and reports `codex-mcp-client 0.146.0-alpha.3.1` as `initialize_only` with `2` successful legacy responses and `0` `server/discover` entries. `_tests/smoke_client_entry_path_report_script.js` guards the new selection mode.
- `2026-07-28`: completed a second bounded `DOC-2A` support package for project-local CBM skill orientation and future task selection. `scripts/audit_directory_docs.js` ranks tracked high-churn directories by `DIRECTORY.md` coverage; `.agents/skills/using-codebase-memory/DIRECTORY.md` and `.agents/skills/using-codebase-memory/references/DIRECTORY.md` are now generator-owned; `_tests/smoke_directory_docs_audit.js` guards no missing maps in the top 20 dirs with churn >= 7. Full offline smoke is GREEN at `7 + 267`.
- `2026-07-28`: completed one bounded `DOC-2A` fallback for the high-churn `_workflow/operator_decisions` ledger. `scripts/generate_directory_docs.js` now owns `_workflow/operator_decisions/DIRECTORY.md`; `_tests/smoke_directory_docs_generator.js` guards the updated decision-ledger groups and active-queue boundary. `ACTIVE_WORKFLOW_INDEX.md` was also synchronized to the current CBM live identity `server_start_id = 2026-07-28T16:05:12.562Z`.
- `2026-07-28`: reviewed upstream `DeusData/codebase-memory-mcp` issues 151-200. Report: `docs/CBM_UPSTREAM_ISSUES_151_200_REVIEW.md`. Local actions: whitespace path/project caveats for `cbm_index_repository`, `cbm_search_code`, and `cbm_get_code_snippet`; trace-path empty-result interpretation guidance; docs directory inventory update. Targeted smokes and live connector probe are GREEN at `server_start_id = 2026-07-28T16:05:12.562Z`.
- `2026-07-28`: reviewed upstream `DeusData/codebase-memory-mcp` issues 101-150. Report: `docs/CBM_UPSTREAM_ISSUES_101_150_REVIEW.md`. Local actions: Windows non-ASCII index-path and project-identifier caveats for `cbm_index_repository`, `cbm_search_code`, and `cbm_get_code_snippet`; skill/tool-reference updates; docs directory inventory update. Targeted smokes and live connector probe are GREEN at `server_start_id = 2026-07-28T15:43:52.823Z`.
- `2026-07-28`: reviewed upstream `DeusData/codebase-memory-mcp` issues 51-100. Report: `docs/CBM_UPSTREAM_ISSUES_51_100_REVIEW.md`. Local actions: broader source-bearing excluded-route detection, Windows non-ASCII `search_code` caveats, unsupported Cypher shape caveats, and resident-set discovery guidance. Targeted smokes, self-test, full offline smoke, restart `manual-1785252329171`, and live connector probes are GREEN at `server_start_id = 2026-07-28T15:25:30.678Z`.
- `2026-07-28`: reviewed the first 50 open upstream `DeusData/codebase-memory-mcp` issues and comments. Report: `docs/CBM_UPSTREAM_ISSUES_FIRST50_REVIEW.md`. Local bridge actions: semantic-only `search_graph` suppresses unfiltered structural `results` while preserving `semantic_results`; `index_repository` warns on source-bearing excluded route directories such as `pages/api/assets`; specs and skill guidance were updated. Targeted smokes, full offline smoke, self-test, restart `manual-1785214492092`, and live connector probes are GREEN at `server_start_id = 2026-07-28T04:54:53.586Z`.
- `2026-07-28`: tightened CBM agent guidance and live partial-result regression coverage. `.agents/skills/using-codebase-memory/SKILL.md` now instructs agents to prefer structured `bridge_analysis`, `impact_resolution_reason`, and `runtime_edge_creation` fields over warning prose; `_tests/smoke_cbm_agent_skill.js` guards those markers; `_tests/smoke_cbm_live_bridge_stress.js` now exercises live `cbm_detect_changes` and `cbm_ingest_traces` metadata. Targeted smokes and full offline smoke are GREEN at `7 + 266`; no connector-visible surface change was made.
- `2026-07-28`: completed manual CBM bridge sample-repo stress closeout. `_tests/stress_cbm_bridge_samples.js` validates all exposed CBM bridge tools repeatedly across selected `_repos_with_code_samples`; the strict default four-repo run recorded `663` exact calls across all fifteen `cbm_*` tools, including lifecycle `index/delete`, with `instability=[]`, and earlier large-repo stress stayed stable after fixing volatile `cbm_search_code` warning normalization. Full offline smoke is GREEN at `7 + 266`; no connector-visible surface change was made.
- `2026-07-28`: live-loaded CBM partial-result metadata on OAuth21 `3008` at `server_start_id = 2026-07-28T04:54:53.586Z`. `detect_changes` exposes returned/omitted totals, `bridge_analysis`, and `impact_resolution_reason`; `ingest_traces` exposes `runtime_edge_creation` and `runtime_edges_created`; semantic-only `search_graph` suppression and source-bearing excluded-route warnings are live. Live probes confirmed the new fields; no connector refresh was required.
- `2026-07-27`: refreshed `COMP-1A` against explicit live `server_start_id 2026-07-27T03:10:26.042Z`. Operational `openai-mcp 1.0.0` remains `initialize_only` with `8` successful responses and `0` `server/discover` entries. The shared child-server helper now isolates audit output, and the report selects and attributes a named live window without deleting historical test evidence.
- `2026-07-27`: completed one bounded `DOC-2A` fallback for the high-churn CBM integration boundary. `scripts/generate_directory_docs.js` now owns `src/integrations/DIRECTORY.md` and `src/integrations/codebase_memory/DIRECTORY.md`; generator and operator-contract guards preserve the map and its repository/runtime/index truth boundary.
- `2026-07-27`: closed test-harness control-state pollution. Self-test no longer starts the restart controller or writes tool-surface state; every smoke child-server now uses hermetic surface/restart/rate paths; the restored operational `tool-surface-state.json` remains at 84 tools and `server_start_id = 2026-07-27T03:10:26.042Z` across standalone harnesses, self-test, and the full suite. No additional restart was required.
- `2026-07-27`: completed final live load for CBM reliability hardening and native-cache repair. The refreshed runtime exposes stdin transport, duplicate change normalization, fail-fast startup configuration, operator-neutral executable fallback, fail-closed ADR snapshot gating, shared OAuth/HTTP helpers, and repaired v0.9.0 cache schemas at unchanged 84-tool identity. Live delete verification returned `deleted` then `cbm_project_not_found`; full offline smoke is GREEN at `7 + 266`. Report: `docs/CBM_RELIABILITY_HARDENING_REPORT.md`.
- `2026-07-26`: completed the initial live CBM v0.9.0 surface rollout. The refreshed connector exposed `state_handle`; two-phase deletion returned `deleted`; a fresh second challenge returned `cbm_project_not_found`; `_tests/fixtures/cbm-live-fixture` remained intact; the historical combined fingerprint was `6a1329e3b3892b9c`.
- `2026-07-26`: completed the isolated fresh-cache v0.9.0 CBM rebaseline across `mcp-tests`, `papers-memory-mcp`, and `autonomous_llm_handbook`; report: `docs/CBM_V0_9_0_REBASELINE_REPORT.md`. Native path scoping, recursion handling, ambiguity handling, and concurrency improved; bridge compensations now cover output bounding, scope enforcement, ADR restoration, trace placeholder warnings, and project-not-found classification.
- `2026-07-17`: read-only remote-site flows (`list`, `read`, runtime status, retention preview) no longer create remote ops directories as a side effect. Guarded by `smoke_remote_site_lifecycle` and the full `run_all_smokes --skip-network` suite.
- `2026-07-17`: refreshed `COMP-1A` evidence still shows live OAuth21 `/mcp` current-window traffic as `initialize_only` for `codex-mcp-client 0.145.0-alpha.18`, with the retained blocker already present in `1d` and `2d` operational windows.
- `2026-07-17`: completed `DOC-2A` by extending bounded directory-map coverage into the runtime-owned control-plane backup roots and live prune bundle docs, while keeping the next package inferable from workflow docs alone.

## Current readiness rule

Do not treat a maturity score as permission to remove compatibility paths without:

- repo evidence
- live runtime evidence
- client/connector evidence
- smoke coverage
