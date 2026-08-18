# State

Status: active as-is summary
Updated: 2026-08-17

## Purpose

Summarize the current validated product state in one operator-facing place without replacing the canonical specs or workflow canon.

## Current as-is state

- Repository: `C:\Work\mcp-tests`
- Current branch: `feature/cbm-cli-bridge-mvp`
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
  - repository target connector-visible tools `98`

## Current validation baseline

- Latest full smoke baseline:
  - `node ./_tests/run_all_smokes.js --skip-network = ok=true, version=0.40.0, public=7, tests_authenticated=308`
- Latest validated public section count: `7`
- Latest validated authenticated smoke count: `308`

## Surface model

- Public MCP-visible tools: `13`
- Authorized MCP-visible tools: `85`
- Authenticated repo target for profile `tests`: `98`
- Live OAuth21 runtime exposes `98` tools at `server_start_id = 2026-08-18T14:53:56.306Z` with governed fingerprint `93721a82a339f9d6`. Controlled restart `manual-1787064834593` loaded source commit `2ae1585`; `/healthz` returned OAuth21/internal with `98` tools, `/oauth/operator-login` no longer trips the MCP Origin guard, `/mcp` still rejects invalid Origin, the refreshed `openai-mcp 1.0.0` connector received the same 98-tool fingerprint, and a durable pre-restart process record was recovered after restart.
- MCP Tasks P0 is live and accepted: a modern localhost client declared `io.modelcontextprotocol/tasks`, `server/discover` advertised the extension, `run_process` returned a Task, and `tasks/get` reached `completed/complete` with expected output, argv redaction, and task-backed metadata. Non-Tasks clients retain the synchronous fallback. Repository validation remains `7 + 294`.
- W3C Trace Context P1 is live and accepted: live `run_process` request span `b30d7ed041609eb6` created execution child `bdff6e5f06b04cce`; a Task-backed execution persisted trace `8dd0f95cfb76cfa719af99c69bc8e2ae`, child `1f4deb3e376e86f7`, and parent `addcaee3ad7e0838` through the durable process/artifact spine. Repository validation remains `7 + 298`.
- Process Artifacts P2 is live and accepted: terminal stdout/stderr is materialized immutably in `tests_process_jobs_3008.sqlite` with opaque IDs, SHA-256, independent retention, and W3C ancestry. Authenticated live `resources/read` returned the expected Task stdout through an explicit `mcp-artifact://process/<opaque-id>` URI. Repository validation remains `7 + 301`.
- CIMD P3 is live and accepted: the runtime SSRF boundary rejected `client_id = https://127.0.0.1/oauth/client.json` with controlled `400 invalid_client`; audit recorded `oauth21_cimd_rejected` / `cimd_special_use_ip`. Repository validation remains `7 + 304`.
- MRTR P4 remains fixture-only protocol conformance evidence and has no production runtime surface to load. The official v2 client regression passed clean-history `7 + 305`; the controlled runtime restart neither adds nor requires an MRTR tool or store.
- `DEBT-1` cleanup is complete and live-loaded: `McpSession`, `sampling_context`, SSE outbound queuing, pending request correlation, and classic Sampling policy execution are removed. The active HTTP dispatchers reject unsolicited JSON-RPC responses with `server_initiated_requests_not_active`; restart `manual-1786939596474` loaded the change without altering the `98`-tool connector surface or requiring OAuth reauthorization.
- `POL-1` remains active at `2/4`: current repository and live-runtime truth now prove `14/24` required policies implemented. Transport security rejects invalid present `Origin`, OAuth21/internal tool dispatch requires granted `mcp:tools`, session security matches the stateless MCP `2026-07-28` target, and output DLP centralizes JSON Schema 2020-12 validation, secret redaction, untrusted-output labels, resource-link filtering, and embedded-resource fail-closed handling across optional tools, core search/fetch, and process Tasks. Ten required policies remain non-implemented: four partial, four specified-only, and two critical (`consent`, `prompt/content`). Final DLP source commit `b385c88` is live on OAuth21 `3008` at `server_start_id = 2026-08-18T04:39:45.722Z`; health is `200`, durable process state recovered across restart, `read_file` remains callable, and the live runtime surface is `98` tools with output `8292895f0216967c`, descriptor `82ffaaa3adb6e7db`, combined `93721a82a339f9d6`. That reconnect exposed a POL-1A transport regression: the global `Origin` gate intercepted authorization-server POST `/oauth/operator-login`. Source commit `2ae1585` scopes mandatory Origin rejection to the Streamable HTTP `/mcp` endpoint and is live at `server_start_id = 2026-08-18T14:53:56.306Z`. Live proof shows `/oauth/operator-login` with `Origin: null` now reaches the OAuth handler (`400` only for the synthetic expired `pid`) while `/mcp` with the same origin still returns `403 Invalid Origin`; durable process recovery is green. Independently, the operator's earlier green refresh is server-audited: `openai-mcp 1.0.0` completed `server/discover` and `tools/list` with HTTP `200`, `98` tools, `ttl_ms = 0`, `cache_scope = private`, and fingerprint `93721a82a339f9d6`. Therefore both `restart_required_now = false` and `connector_refresh_required_now = false`.
- Server-internal helper tools remain intentionally hidden from MCP schema/tools-list

## Current workflow track

- `current_working_course = policy-coverage-critical-gap-closure`
- `next_primary = pol-1a-consent-boundary`
- `next_secondary = pol-1a-prompt-content-boundary`

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
- Runtime snapshot creation resolves repository scope from the script location rather than caller cwd, stages all files and the manifest under a unique `.pending-*` directory, publishes with a bounded same-volume rename retry for transient Windows `EACCES`/`EBUSY`/`EPERM`, and removes staging on failure. The smoke validates foreign-cwd fidelity, deterministic transient-rename recovery, success cleanup, and mid-copy rollback, then removes only its own uniquely labelled direct-child fixture in `finally`. The full `run_all` orchestrator resolves its server, auth patch, sandbox, child processes, and relative manifest from the repository root; options are fail-closed, child-server exit is awaited, and per-run OAuth/process/audit storage is removed in `finally`. The no-pollution guard executes the full inner run from a foreign cwd and verifies unchanged audit, snapshot, and run-temp sets. A one-time snapshot cleanup removed `684` smoke artifacts while preserving all `17` named operational snapshots; a separate guarded temp cleanup removed `298` stale run stores (`72,496,903` bytes) and conservatively retained `13` directories whose historical PID is currently occupied.
- Live `cbm_get_code_snippet` now validates that source contains the requested symbol. The reproduced native v0.9.0 mismatch for `searchIndex` preserved native lines `898-909` but recovered verified repository lines `1073-1084`, returned the actual declaration, and exposed `source_integrity: bridge_recovered`, `source_reliable: true`, and structured recovery evidence. Unrecoverable results expose `source_reliable: false`.
- Fresh isolated-cache evidence is recorded in `docs/CBM_V0_9_0_REBASELINE_REPORT.md`; it confirms native v0.9.0 improvements and bridge compensations for bounded change impact, ADR preservation, trace placeholder semantics, scope enforcement, and stable not-found errors. Upstream issue reviews are recorded in `docs/CBM_UPSTREAM_ISSUES_FIRST50_REVIEW.md`, `docs/CBM_UPSTREAM_ISSUES_51_100_REVIEW.md`, `docs/CBM_UPSTREAM_ISSUES_101_150_REVIEW.md`, `docs/CBM_UPSTREAM_ISSUES_151_200_REVIEW.md`, and `docs/CBM_UPSTREAM_ISSUES_201_277_REVIEW.md`.
- Project-local CBM operating guidance is available at `.agents/skills/using-codebase-memory/SKILL.md`; its tool reference and seven decision scenarios are guarded by `_tests/smoke_cbm_agent_skill.js`. The main skill now directs agents to prefer structured `bridge_analysis`, `impact_resolution_reason`, `runtime_edge_creation`, discovery absence, source-bearing exclusion, Windows non-ASCII, whitespace path/project, Cypher caveat metadata, and the CBM-vs-knowledge-index boundary over warning prose.
- Manual CBM bridge stress coverage is available at `_tests/stress_cbm_bridge_samples.js`; the July 28, 2026 strict validation covered the default four-repo sample set with `663` exact recorded calls, `52` `cbm_index_repository`, `52` `cbm_delete_project`, `52` `cbm_manage_adr`, `48` calls for each project read/analysis tool, `instability=[]`, and max `8196 ms`. Earlier large-repo stress also stayed stable. `_tests/smoke_cbm_live_bridge_stress.js` now also asserts live `cbm_detect_changes` partial-result metadata and `cbm_ingest_traces` runtime-edge placeholder metadata. The package found and fixed volatile native `search took <ms>` warning leakage in `cbm_search_code` and then tightened lifecycle/count accounting without changing the connector-visible surface.
- Native CBM `--version`, `--help`, and `cli --json` subprocesses now execute from the same resolved authorized workspace root exported as `CBM_ALLOWED_ROOT`, rather than inheriting the server process cwd. Deterministic probe/call assertions, four targeted CBM smokes, and full `7 + 306` validation are green. Controlled restart `manual-1786979475830` loaded commit `cbdc12c` at `server_start_id = 2026-08-17T15:11:17.544Z`; live `cbm_status` reports `allowed_root = C:\Work`, and `cbm_list_projects` completed with `exit 0` and no warnings.
- Generator-owned source orientation now includes `src/integrations/DIRECTORY.md` and `src/integrations/codebase_memory/DIRECTORY.md`; the CBM map identifies transport, contract-registry, orchestration, and versioned-contract responsibilities while preserving repository, runtime, and index truth boundaries.
- Generator-owned workflow orientation now includes `_workflow/operator_decisions/DIRECTORY.md`; the refreshed map separates current initialize/connector/OAuth decision evidence from historical package ledgers and points back to active workflow truth for priority.
- Generator-owned project-local skill orientation now includes `.agents/skills/using-codebase-memory/DIRECTORY.md` and `.agents/skills/using-codebase-memory/references/DIRECTORY.md`; `scripts/audit_directory_docs.js` ranks high-churn directories so future `DOC-2A` choices are evidence-driven.
- `DOC-1` is accepted at `4/4`: one fresh `index_status` result exposes current next-package markers, component maturity/blocker/default-package data, ordered roadmap actions, canonical health, runtime identity, and documentation gaps. Live planning, maturity, and proof queries select the intended evidence without manual cross-reading.
- `DOC-2` is accepted at `4/4`: all `68/68` directories containing tracked files have functional maps. The generator provides non-mutating `--help`/`--check`, rejects unknown arguments before writes, and the repo-wide smoke guard prevents new tracked directories from silently bypassing the operator documentation contract.
- Workflow truth and runtime truth must stay separated.
- Connector/UI truth may drift from repo/runtime truth and requires live verification.
- Model-runtime callability is a separate layer from external UI visible-tool enumeration.
- `PROC-1A` remains accepted and live. `PROC-1B` provides a SQLite WAL owner-scoped job/event registry, restart recovery without command replay, controlled error envelopes, Windows `py` launcher fidelity, and functional PowerShell resolution. `PROC-1B-R1` adds renewable server-instance leases plus periodic orphan reconciliation to prevent PID reuse from preserving a crashed job indefinitely; two controlled restarts loaded the correction, one active lease remains, and the same live job retained terminal state, output, and event history with `recovered_after_restart=true`.
- `PROC-1B-R2` is live and accepted: `process_start` reserves one logical execution atomically by OAuth owner plus opaque idempotency key and canonical effective command semantics. Equal retries reuse the durable job before queue-capacity checks and after restart; conflicts are deterministic; OAuth runtime key hashes are HMAC-bound; raw keys, args, and env remain excluded. Live job `1121654d-5016-4cac-84e3-30b4d69630de` retained identity and output after restart with `recovered_after_restart=true`.
- Persistent task memory is not project queue authority. Current `memory_get_tasks(status=pending)` exposes no pending Codex-owned `mcp-tests` package; the remaining shared pending item is unrelated and assigned to Hermes. Active project work comes from `WORKFLOW_CANON.md` plus `ACTIVE_WORKFLOW_INDEX.md`.
- Fresh 2026-07-15 evidence confirms `mcp__workbench` is callable again from this Codex runtime session, but the 84-tool connector surface has now been re-enumerated through the refreshed ChatGPT connector.
- Fresh 2026-07-15 client-entry observability now distinguishes stale entry windows from real reconnect evidence: a current window that shows only follow-up `tools/call` traffic does not by itself prove any change in client entry path.
- `OBS-1` is live-accepted at `4/4`. On `server_start_id = 2026-08-17T04:06:37.912Z`, bounded diagnostics read the audit trail with zero parse errors, classified `11` follow-up tool calls without an entry event as `stale_entry_window`, and retained the Codex initialize blocker across `1d`/`2d`/`7d`/`30d`/`all`. All named-option local JavaScript CLI entrypoints now converge on shared fail-closed parsing, including declared repeatable snapshot/project/trace options; both value forms are accepted, while malformed, duplicate, conflicting, or out-of-range arguments fail before evidence scope or mutation behavior can change. Relative paths in the mutating marker-patch and runtime-log compaction CLIs resolve from the repository root rather than caller cwd; absolute paths retain their prior explicit semantics.
- Root spec loading and the active fixture, decision-runtime, negative-control, and index-authority read-only CLIs derive repository scope from `__dirname` rather than caller cwd. Explicit relative spec arguments resolve from the repository root and absolute spec paths remain supported; one aggregate foreign-cwd regression and all seven dedicated smokes are green.
- The obsolete `public_sandbox_sync.js` control-plane mutator is retired. It had no active consumer, its only historical smoke depends on a missing manifest, and its unguarded operation duplicated seven active runtime files into ignored non-authoritative storage. A current retirement guard prevents accidental restoration while Git preserves the historical evidence.
- Deploy planning now treats startup-loaded `src/**`, `tools/**`, `profiles/**`, `plugins/**`, root `SERVER_*_SPEC.json`, and package manifests as runtime changes after normalizing relative, absolute, and Windows-style paths. Guard v2 preserves the specialized compatibility-metadata path and keeps documentation/tests repo-only; live acceptance at `server_start_id = 2026-08-17T15:20:52.127Z` returned `runtime_restart_required` for the reproduced CBM bridge change without requiring connector refresh or operator approval.
- The final MCP `2026-07-28` dual-era adapter and DCR `application_type` compatibility policy are live at `server_start_id 2026-08-01T20:29:11.207Z`. Official `@modelcontextprotocol/client@2.0.0` interop now proves default legacy plus automatic and pinned modern paths end-to-end, and a hermetic authenticated extension proves DCR, PKCE S256, callback `state`/`iss`, issuer-bound credentials, full authorized list/call, process-restart recovery of client and token state from SQLite, and automatic refresh-token rotation after restart. Modern requests use per-request metadata, `Mcp-Method`/`Mcp-Name` validation, final error codes, modern result envelopes, and server identity metadata; legacy initialize-era traffic remains isolated from that adapter.
- Fresh August 17 `COMP-1A` evidence supersedes the August 16 sample: the current Codex entry window selects `server_start_id 2026-08-16T19:04:37.288Z` and shows `initialize_only` for `codex-mcp-client 0.148.0-alpha.9` on protocol `2025-06-18`, with `3` successful legacy `initialize` entries and `0` `server/discover` entries. Independent operational `openai-mcp 1.0.0` traffic uses `server/discover` with protocol `2026-07-28`; modern entry therefore works operationally, but retirement remains blocked by the Codex client family.

- `OPS-1B` is closed and `OPS-1` is `4/4`. The August 16 OAuth reconnect/recovery evidence remains accepted; on August 17 connector-visible TEST MCP used external config ref `C:\Work\www\remote-site-tools-config.json` to list the real site root, read the retained smoke file, and inspect `opsRoot`, which reported `healthy` with no warnings. The acceptance performed no remote write/edit/move/delete/restore and required no credential migration, runtime restart, connector refresh, or change to the `www` repository.
- The former bounded `DOC-2A` fallback is superseded by accepted repo-wide `DOC-2` coverage. Reopen it only when generator `--check` or the tracked-directory audit reports a real regression.
- Live `observability_status` now exposes the same retained blocker-matrix view as the workflow helper, so current-window entry evidence and `1d`/`2d`/`7d`/`30d`/`all` blocker framing no longer depend on a script-only code path.
- `state.json` is an orientation map, not a progress log.
- Operator-facing documentation is explicit, and every directory containing tracked project files has a guarded functional map.
- OAuth21 durable-state hygiene now has an explicit control-plane path with bounded records/backups and approval-gated apply; it is not a connector-visible runtime tool.
- Public unauthenticated OAuth21 routes now have bounded per-IP throttling, and oversized OAuth21 request bodies are force-aborted before they can continue streaming in-process.
- OAuth21 DCR registration now enforces a bounded client-registry cap and opportunistically prunes retention-expired `dead_clients` before admitting new public registrations.
- OAuth21 PKCE validation distinguishes the RFC 7636 verifier grammar (`43..128` unreserved characters) from the canonical `S256` challenge representation (exactly 43 base64url characters). PKCE rejection audit events expose bounded reason/client/grant metadata without verifier or challenge values. Full offline validation is GREEN at `7 + 268`; controlled restart `manual-1785349273914` loaded the change, a live 44-character challenge returned `code_challenge_invalid`, and `workbench.get_info` remained callable.
- Memory embeddings are live and accepted at `server_start_id = 2026-08-01T18:52:13.024Z`, PID `24132`. The protected token-file path is ready, explicit egress is enabled, `activation_ready=true`, live EN-to-PL and PL-to-EN probes rank the intended memories first, and a controlled missing-token-file probe preserved lexical fallback. The non-plaintext SQLite cache contains all `67` active unique memory embeddings after an idempotent `64/64` backfill. Exact Unicode lexical tokens plus bounded EN/PL stop words prevent common substring noise from outranking valid semantic results.
