# State

Status: active as-is summary
Updated: 2026-07-28

## Purpose

Summarize the current validated product state in one operator-facing place without replacing the canonical specs or workflow canon.

## Current as-is state

- Repository: `C:\Work\mcp-tests`
- Branch expectation: `main`
- Runtime entrypoint: `server.js`
- Server identity: `mcp-tests-response-shape`
- Server version: `0.40.0`
- Connector shape version: `2025-05-strict-v1`
- Output mode: `structured`

## Runtime topology

- Public runtime
  - port `3009`
  - auth mode `none`
  - target connector-visible tools `13`

- Authorized runtime
  - port `3008`
  - auth mode `oauth21`
  - profile `tests/internal`
  - target connector-visible tools `84`

## Current validation baseline

- Latest full smoke baseline:
  - `node ./_tests/run_all_smokes.js --skip-network = ok=true, version=0.40.0, public=7, tests_authenticated=268`
- Latest validated public section count: `7`
- Latest validated authenticated smoke count: `268`

## Surface model

- Public MCP-visible tools: `13`
- Authorized MCP-visible tools: `71`
- Authenticated repo target for profile `tests`: `84`
- Current live OAuth21 runtime and connector count: `84`; the hardened CBM v0.9.0 contract, including stdin native transport, normalized change results, partial-result metadata, semantic-only suppression, source-bearing excluded-route warnings, Windows non-ASCII and whitespace path/project caveats, Cypher shape caveats, repaired ADR storage, and `state_handle` confirmation, is live at `server_start_id = 2026-07-28T16:05:12.562Z` with unchanged connector-visible surface. No connector refresh remains pending.
- Server-internal helper tools remain intentionally hidden from MCP schema/tools-list

## Current workflow track

- `current_working_course = initialize-retirement-evidence-wait`
- `next_primary = comp-1a-on-fresh-external-client-traffic`
- `next_secondary = bounded-doc-orientation-maintenance`

## Verified documentation authorities

- Canonical workflow truth:
  - `_workflow/WORKFLOW_CANON.md`
  - `_workflow/ACTIVE_WORKFLOW_INDEX.md`
  - `_workflow/state.json`

- Canonical server truth:
  - `SERVER_SPEC.json`
  - `SERVER_AUTH_SPEC.json`
  - `SERVER_CONNECTOR_SURFACE_SPEC.json`
  - `SERVER_TOOLS_SPEC.json`
  - related `SERVER_*_SPEC.json` policy/runtime documents

## Current operational caveats

- Profile `tests` controls the complete authenticated tool surface. CBM dependency availability must not add or remove `cbm_*` descriptors.
- Local CBM binary is `0.9.0` (SHA-256 `9a205fa5ae759fbc866bfe1554f0c05a303be9ae6e0a00f94d875dc0c25e0680`). The refreshed connector exposes `state_handle`; live two-phase deletion returned `deleted`, replay through a fresh challenge returned `cbm_project_not_found`, and `_tests/fixtures/cbm-live-fixture` remained intact.
- Repository-side reliability hardening is GREEN and live-loaded on OAuth21 `3008` at `server_start_id = 2026-07-28T16:05:12.562Z`: native payloads use stdin instead of raw JSON argv; `detect_changes` is deduplicated before bounding and now exposes exact returned/omitted totals, `bridge_analysis`, and `impact_resolution_reason`; `ingest_traces` exposes `runtime_edge_creation` and `runtime_edges_created`; semantic-only `search_graph` suppresses unfiltered structural `results`; `index_repository` warns on known source-bearing excluded route directories, Windows non-ASCII paths, and whitespace paths; `search_code` warns on Windows non-ASCII patterns plus non-ASCII or whitespace project identifiers; `get_code_snippet` warns on Windows non-ASCII or whitespace project identifiers; `query_graph` warns on unsupported Cypher shapes; runtime output configuration fails before side effects; executable fallback is operator-neutral; and existing-project indexing is blocked when ADR snapshot retrieval fails. Test processes use hermetic control-state paths, and no restart or connector refresh is pending.
- Fresh isolated-cache evidence is recorded in `docs/CBM_V0_9_0_REBASELINE_REPORT.md`; it confirms native v0.9.0 improvements and bridge compensations for bounded change impact, ADR preservation, trace placeholder semantics, scope enforcement, and stable not-found errors. Upstream issue reviews are recorded in `docs/CBM_UPSTREAM_ISSUES_FIRST50_REVIEW.md`, `docs/CBM_UPSTREAM_ISSUES_51_100_REVIEW.md`, `docs/CBM_UPSTREAM_ISSUES_101_150_REVIEW.md`, `docs/CBM_UPSTREAM_ISSUES_151_200_REVIEW.md`, and `docs/CBM_UPSTREAM_ISSUES_201_277_REVIEW.md`.
- Project-local CBM operating guidance is available at `.agents/skills/using-codebase-memory/SKILL.md`; its tool reference and seven decision scenarios are guarded by `_tests/smoke_cbm_agent_skill.js`. The main skill now directs agents to prefer structured `bridge_analysis`, `impact_resolution_reason`, `runtime_edge_creation`, discovery absence, source-bearing exclusion, Windows non-ASCII, whitespace path/project, Cypher caveat metadata, and the CBM-vs-knowledge-index boundary over warning prose.
- Manual CBM bridge stress coverage is available at `_tests/stress_cbm_bridge_samples.js`; the July 28, 2026 strict validation covered the default four-repo sample set with `663` exact recorded calls, `52` `cbm_index_repository`, `52` `cbm_delete_project`, `52` `cbm_manage_adr`, `48` calls for each project read/analysis tool, `instability=[]`, and max `8196 ms`. Earlier large-repo stress also stayed stable. `_tests/smoke_cbm_live_bridge_stress.js` now also asserts live `cbm_detect_changes` partial-result metadata and `cbm_ingest_traces` runtime-edge placeholder metadata. The package found and fixed volatile native `search took <ms>` warning leakage in `cbm_search_code` and then tightened lifecycle/count accounting without changing the connector-visible surface.
- Generator-owned source orientation now includes `src/integrations/DIRECTORY.md` and `src/integrations/codebase_memory/DIRECTORY.md`; the CBM map identifies transport, contract-registry, orchestration, and versioned-contract responsibilities while preserving repository, runtime, and index truth boundaries.
- Generator-owned workflow orientation now includes `_workflow/operator_decisions/DIRECTORY.md`; the refreshed map separates current initialize/connector/OAuth decision evidence from historical package ledgers and points back to active workflow truth for priority.
- Generator-owned project-local skill orientation now includes `.agents/skills/using-codebase-memory/DIRECTORY.md` and `.agents/skills/using-codebase-memory/references/DIRECTORY.md`; `scripts/audit_directory_docs.js` ranks high-churn directories so future `DOC-2A` choices are evidence-driven.
- Workflow truth and runtime truth must stay separated.
- Connector/UI truth may drift from repo/runtime truth and requires live verification.
- Model-runtime callability is a separate layer from external UI visible-tool enumeration.
- Fresh 2026-07-15 evidence confirms `mcp__workbench` is callable again from this Codex runtime session, but the 84-tool connector surface has now been re-enumerated through the refreshed ChatGPT connector.
- Fresh 2026-07-15 client-entry observability now distinguishes stale entry windows from real reconnect evidence: a current window that shows only follow-up `tools/call` traffic does not by itself prove any change in client entry path.
- Fresh repo-native `2026-07-28` client-entry reporting distinguishes the stale latest runtime slice from the newest real entry window. Latest live `server_start_id 2026-07-28T16:05:12.562Z` has follow-up traffic only, while `--latest-entry-window` selects `server_start_id 2026-07-28T03:49:00.666Z` and shows `initialize_only` for `codex-mcp-client 0.146.0-alpha.3.1` on protocol `2025-06-18`, with `2` successful legacy `initialize` responses and `0` `server/discover` entries.
- Test child-server audit isolation, explicit report selection, and latest-entry-window selection are now guarded; historical synthetic starts remain preserved but no longer displace the selected live window. Because the July 28, 2026 `COMP-1A` refresh still blocks retirement, another refresh is allowed only after newer external client traffic creates a meaningfully new evidence window.
- The July 28 `_workflow/operator_decisions` directory-map instance of `DOC-2A` is complete. `DOC-2A` remains a reusable bounded fallback, not a permanently open task, and may run again only for a demonstrable current high-churn orientation gap.
- Live `observability_status` now exposes the same retained blocker-matrix view as the workflow helper, so current-window entry evidence and `1d`/`2d`/`7d`/`30d`/`all` blocker framing no longer depend on a script-only code path.
- `state.json` is an orientation map, not a progress log.
- Operator-facing documentation is now explicit, but directory coverage is not yet complete for every repo directory.
- OAuth21 durable-state hygiene now has an explicit control-plane path with bounded records/backups and approval-gated apply; it is not a connector-visible runtime tool.
- Public unauthenticated OAuth21 routes now have bounded per-IP throttling, and oversized OAuth21 request bodies are force-aborted before they can continue streaming in-process.
- OAuth21 DCR registration now enforces a bounded client-registry cap and opportunistically prunes retention-expired `dead_clients` before admitting new public registrations.
