# State

Status: active as-is summary
Updated: 2026-08-01

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
  - `node ./_tests/run_all_smokes.js --skip-network = ok=true, version=0.40.0, public=7, tests_authenticated=270`
- Latest validated public section count: `7`
- Latest validated authenticated smoke count: `270`

## Surface model

- Public MCP-visible tools: `13`
- Authorized MCP-visible tools: `71`
- Authenticated repo target for profile `tests`: `84`
- Current live OAuth21 runtime and connector count: `84`; the hardened CBM v0.9.0, canonical PKCE, activated OVH-backed memory, freshness-aware retrieval, and final dual-era protocol contracts are live at `server_start_id = 2026-08-01T20:29:11.207Z`. The v3 knowledge index is fresh, complete for all `11` readiness rows, and passes current-state acceptance queries; no restart or manual connector refresh is pending.
- Server-internal helper tools remain intentionally hidden from MCP schema/tools-list

## Current workflow track

- `current_working_course = protocol-compatibility-evidence-gate`
- `next_primary = comp-1a-on-fresh-external-client-traffic`
- `next_secondary = doc-2a-on-demonstrated-orientation-gap`

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
- Repository-side reliability hardening is GREEN and live-loaded on OAuth21 `3008` at `server_start_id = 2026-07-29T18:53:50.174Z`: native payloads use stdin instead of raw JSON argv; `detect_changes` is deduplicated before bounding and exposes exact totals and impact metadata; `ingest_traces` exposes runtime-edge status; semantic-only `search_graph` suppresses unfiltered structural results; source-bearing exclusions, Windows path/project caveats, and Cypher shape caveats remain explicit; runtime output configuration fails before side effects; executable fallback is operator-neutral; and existing-project indexing is blocked when ADR snapshot retrieval fails. Test processes use hermetic control-state paths.
- Live `cbm_get_code_snippet` now validates that source contains the requested symbol. The reproduced native v0.9.0 mismatch for `searchIndex` preserved native lines `898-909` but recovered verified repository lines `1073-1084`, returned the actual declaration, and exposed `source_integrity: bridge_recovered`, `source_reliable: true`, and structured recovery evidence. Unrecoverable results expose `source_reliable: false`.
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
- The final MCP `2026-07-28` dual-era adapter and DCR `application_type` compatibility policy are live at `server_start_id 2026-08-01T20:29:11.207Z`. Modern requests use per-request metadata, `Mcp-Method`/`Mcp-Name` validation, final error codes, modern result envelopes, and server identity metadata; legacy initialize-era traffic remains isolated from that adapter.
- Fresh `COMP-1A` evidence selects `server_start_id 2026-08-01T17:51:19.986Z` and shows `initialize_only` for `codex-mcp-client 0.146.0-alpha.9.2` on protocol `2025-06-18`, with `2` legacy entries and `0` `server/discover` entries. Server capability is ready, but retirement remains blocked by client behavior.
- The July 28 `_workflow/operator_decisions` directory-map instance of `DOC-2A` is complete. `DOC-2A` remains a reusable bounded fallback, not a permanently open task, and may run again only for a demonstrable current high-churn orientation gap.
- Live `observability_status` now exposes the same retained blocker-matrix view as the workflow helper, so current-window entry evidence and `1d`/`2d`/`7d`/`30d`/`all` blocker framing no longer depend on a script-only code path.
- `state.json` is an orientation map, not a progress log.
- Operator-facing documentation is now explicit, but directory coverage is not yet complete for every repo directory.
- OAuth21 durable-state hygiene now has an explicit control-plane path with bounded records/backups and approval-gated apply; it is not a connector-visible runtime tool.
- Public unauthenticated OAuth21 routes now have bounded per-IP throttling, and oversized OAuth21 request bodies are force-aborted before they can continue streaming in-process.
- OAuth21 DCR registration now enforces a bounded client-registry cap and opportunistically prunes retention-expired `dead_clients` before admitting new public registrations.
- OAuth21 PKCE validation distinguishes the RFC 7636 verifier grammar (`43..128` unreserved characters) from the canonical `S256` challenge representation (exactly 43 base64url characters). PKCE rejection audit events expose bounded reason/client/grant metadata without verifier or challenge values. Full offline validation is GREEN at `7 + 268`; controlled restart `manual-1785349273914` loaded the change, a live 44-character challenge returned `code_challenge_invalid`, and `workbench.get_info` remained callable.
- Memory embeddings are live and accepted at `server_start_id = 2026-08-01T18:52:13.024Z`, PID `24132`. The protected token-file path is ready, explicit egress is enabled, `activation_ready=true`, live EN-to-PL and PL-to-EN probes rank the intended memories first, and a controlled missing-token-file probe preserved lexical fallback. The non-plaintext SQLite cache contains all `67` active unique memory embeddings after an idempotent `64/64` backfill. Exact Unicode lexical tokens plus bounded EN/PL stop words prevent common substring noise from outranking valid semantic results.
