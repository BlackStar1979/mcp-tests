# Codebase-Memory v0.9.0 Rebaseline Report

Date: 2026-07-26
Status: repository, isolated-cache, connector, and live destructive-flow validation complete

## Scope

This report records the fresh v0.9.0 rebaseline of the fifteen connector-visible `cbm_*` tools: fourteen native CBM operations plus bridge-only `cbm_status`.

The test used the local executable:

- version: `0.9.0`;
- SHA-256: `9a205fa5ae759fbc866bfe1554f0c05a303be9ae6e0a00f94d875dc0c25e0680`;
- size: `273333760` bytes;
- path: `C:\Users\mczyz\AppData\Local\Programs\codebase-memory-mcp\codebase-memory-mcp.exe`.

The bridge contract was captured from local `--version`, top-level `--help`, and every `cli <tool> --help` invocation. The checked-in manifest is `src/integrations/codebase_memory/contracts/v0.9.0.json`.

## Isolation

The rebaseline used the exact production `cbm_cli_bridge` with a dedicated cache and configuration directory:

- cache: `_control/cbm-v090-cache-2026-07-26T15-02-26-125Z`;
- config: `_control/cbm-v090-config-2026-07-26T15-02-26-125Z`;
- raw bounded report: `_control/cbm-v090-rebaseline-2026-07-26T15-02-26-125Z.json`.

The default CBM cache was not read, deleted, overwritten, or migrated.

## Indexed repositories

| Repository | Files discovered | Nodes | Edges | First full index |
| --- | ---: | ---: | ---: | ---: |
| `C:\Work\mcp-tests` | 1,147 | 15,958 | 29,153 | 8.5 s |
| `C:\Work\papers-memory-mcp` | 1,035 | 23,051 | 69,905 | 5.1 s |
| `C:\Work\autonomous_llm_handbook` | 2,025 | 21,631 | 23,000 | 1.8 s |

All three projects reached native `ready` status. Architecture path scoping reduced the graph in every repository, confirming that `get_architecture.path` works in v0.9.0.

## Execution volume

The primary isolated harness completed 89 native calls. Additional targeted calls validated output bounding, scope enforcement, project-not-found classification, ADR preservation, extended Cypher support, short-name ambiguity, and runtime trace partial-success semantics.

The three-way `search_code` concurrency probe completed successfully. With a bridge capacity of two, two calls started immediately and the third reported approximately 315 ms of queue wait, confirming bounded scheduling and separate queue telemetry.

## Improvements confirmed in native v0.9.0

### Architecture scoping

`get_architecture.path` now produces a materially smaller graph for file or directory scopes. The earlier v0.8.1 observation that the field was ignored is no longer current.

### Qualified-name and recursion analysis

The three previously suspicious symbols were no longer marked recursive:

- `createCbmTools`;
- `StoreBase.connect`;
- `dashboard_rollup_builder.build_rollup`.

A short-name trace for `push` returned `status: ambiguous` instead of merging unrelated functions. Traces using exact qualified names remained separated.

### Cypher support

The following worked:

- simple projections;
- `DISTINCT`;
- `OPTIONAL MATCH`;
- read-only relationship traversal;
- bounded row limits;
- rejection of `CREATE` with `cbm_native_rejected`.

### Search and indexing

- Full indexing succeeded for all three repository types.
- Incremental and no-op routes completed correctly.
- `search_graph`, `get_code_snippet`, and `search_code` returned useful results for JavaScript, Python, and Markdown-heavy repositories.
- Concurrent heavy reads remained stable under the bridge semaphore.

## Native defects or limitations still present

### Incorrect `labels()` aggregation

Both direct aggregation and a `WITH` alias returned a numeric scalar where a label collection was expected:

```text
columns: [labels(n), COUNT(*)]
rows:    [[200, 200]]
```

The bridge does not rewrite Cypher. It now marks this response as partial and emits a verification warning.

### Runtime trace ingestion remains a placeholder

Native v0.9.0 returns:

```text
status: accepted
note: Runtime edge creation from traces not yet implemented
```

It also accepted semantically invalid objects when called directly. Connector input is now strictly validated, and accepted batches with no implemented edge effect are returned as partial success with an explicit warning.

### `trace_path` data-flow parameter scope

`parameter_name` did not produce a clearly distinguishable reduction in the tested traces. Qualified-name call tracing is usable; parameter-specific data-flow output remains untrusted pending an upstream fix or a stronger native contract.

### ADR preservation failure in native reindex

A non-empty ADR disappeared after native `index_repository`, despite the expected preservation behavior. The connector performs snapshot–verify–restore around indexing. Real isolated validation confirmed:

```text
adr_preservation_checked: true
adr_snapshot_available:   true
adr_snapshot_nonempty:    true
adr_restored_by_bridge:   true
preserved content:        exact match
```

The default live `mcp-tests` index later exposed an incompatible ADR store (`missing=edges.local_name_gen`): project listing and index status remained ready, while `manage_adr(get)` could not read the snapshot. Repository-side hardening now fails closed with `cbm_adr_snapshot_unavailable` before native indexing whenever an existing project's ADR snapshot cannot be retrieved. A successfully read empty ADR is a valid snapshot and remains distinguishable through `adr_snapshot_available=true` and `adr_snapshot_nonempty=false`.

### `manage_adr.sections` ambiguity

The local help exposes `sections <array>` but does not define whether it filters, selects, or lists sections. Native results returned all section headings in the tested calls. The bridge does not invent semantics for this field.

## Bridge compensations validated

### Stdin payload transport

Native v0.9.0 accepts tool JSON through stdin. The bridge now invokes `cli --json <tool>` with a piped UTF-8 JSON body instead of appending raw JSON to argv. This removes the native deprecation warning and avoids Windows command-line length failures for schema-valid large ADR and trace payloads. Regression coverage sends a 120,000-character ADR body and verifies that the payload reaches the native fixture without appearing in argv or diagnostics.

### Bounded `detect_changes`

The native result for `mcp-tests` contained 166 changed files and 4,179 impacted symbols and exceeded the earlier child-output limit. The bridge now:

- permits up to 1 MiB of native output for this tool;
- normalizes path separators and removes duplicate changed files and impacted symbols before scope filtering or bounding;
- returns at most 200 unique changed files and 200 unique impacted symbols;
- preserves native and normalized/returned totals;
- emits a bounded warning when duplicate entries are removed;
- exposes truncation flags;
- marks a truncated result as partial;
- marks `changed_files > 0` with no impacted symbols as `impact_resolution: unknown_or_unresolved`.

### Scope enforcement

Native `scope` remained ineffective in the tested Git comparisons. The bridge now applies a normalized path-prefix filter before truncation and exposes:

- `scope`;
- `scope_applied_by_bridge`;
- `native_changed_files_total`;
- `native_impacted_symbols_total`;
- `scope_unresolved_impacted_symbols`.

### Stable not-found classification

A second deletion of the disposable fixture index returned native `status: not_found`. The bridge maps this to `cbm_project_not_found` instead of the generic native rejection code.

### Destructive confirmation

The runtime policy provides a short-lived, subject/client/profile/scopes-bound, one-time confirmation challenge for `cbm_delete_project`. All other destructive tools remain denied by default. Confirmation data is consumed before native execution and is not forwarded to CBM or written to audit payloads.

The first live rollout (`server_start_id: 2026-07-26T15:31:03.110Z`) proved the challenge phase and exposed a client-contract mismatch: the client did not forward the custom token field on the second call. The contract was therefore moved to the existing explicit `state_handle` pattern without changing TTL, project binding, authenticated subject/client/profile/scopes binding, one-time consumption, or audit redaction.

The second live rollout (`server_start_id: 2026-07-26T16:30:04.608Z`) exposed `state_handle` successfully. The first confirmed call returned `status: deleted`; a fresh second challenge and confirmation returned `error_code: cbm_project_not_found` with native `status: not_found`. `_tests/fixtures/cbm-live-fixture` remained present and unchanged as a source directory.

### Trace input validation

Connector-visible traces require:

- `trace_id`;
- `span_id`;
- `name`;
- `start_time_unix_nano`;
- `end_time_unix_nano`.

Unknown top-level trace fields are rejected. Arbitrary bounded attributes remain allowed.

## Per-tool repository-side verdict

| Tool | v0.9.0 repository-side verdict |
| --- | --- |
| `cbm_status` | Live v0.9.0 compatibility, binary identity, queue telemetry, and 14-tool manifest confirmed. |
| `cbm_list_projects` | Stable in isolated cache. |
| `cbm_index_repository` | Full and incremental indexing work; bridge compensates native ADR loss and now blocks existing-project reindex when ADR snapshot retrieval is unavailable. |
| `cbm_index_status` | Stable and consistent with indexes. |
| `cbm_get_graph_schema` | Stable and useful across code and document repositories. |
| `cbm_get_architecture` | Path scoping fixed and confirmed. |
| `cbm_search_graph` | Qualified-name discovery and ambiguity handling improved. |
| `cbm_query_graph` | Most read-only features work; `labels()` aggregation remains defective and warned. |
| `cbm_trace_path` | Same-name ambiguity fixed; parameter-specific data flow remains uncertain. |
| `cbm_get_code_snippet` | Source and recursion metadata substantially improved. |
| `cbm_search_code` | Stable, including bounded three-way concurrency. |
| `cbm_detect_changes` | Native output/scope limitations compensated by bridge bounding and filtering. |
| `cbm_manage_adr` | Read/update work; section semantics unclear; bridge preserves ADR across reindex. |
| `cbm_ingest_traces` | Experimental placeholder, now strict-input and explicit partial success. |
| `cbm_delete_project` | Fully live with `state_handle`; deletion, one-time confirmation, source-tree safety, and `cbm_project_not_found` mapping confirmed. |

## Live rollout closeout

The initial surface rollout and the later hardened live load are complete.

```text
initial_surface_server_start_id: 2026-07-26T16:30:04.608Z
hardened_server_start_id:        2026-07-27T03:10:26.042Z
tool_count:                      84
cbm_tool_count:                  15
tool_names_hash:                 7b5bfc1bd21386d3
input_schema_fingerprint:        fcec449fbbabb6bb
output_schema_fingerprint:       b1a978e09c321b35
descriptor_fingerprint:          61a1d6ce6a31469b
combined_fingerprint:            6a1329e3b3892b9c
```

The disposable projects `cbm-v090-live-delete-fixture-20260726` and `cbm-post-restart-verification-20260727` are absent from `cbm_list_projects`. The source fixture directory remains present. The hardened process now loads stdin native transport, duplicate change normalization, fail-fast startup configuration, operator-neutral executable resolution, ADR snapshot gating, and repaired native cache schemas. No restart or connector refresh remains pending.
