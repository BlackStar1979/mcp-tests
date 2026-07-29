# CBM Tool Reference

Load when: selecting or invoking a `cbm_*` tool, interpreting its result envelope, or handling tool-specific limitations.

## Surface

The connector exposes fifteen tools: 14 native operations plus bridge-only `cbm_status`. The verified native contract is codebase-memory v0.9.0.

CBM is the code-graph layer. It is not the documentation/workflow retrieval layer. For project state, workflow files, reports, specs, ADR text on disk, Markdown prose, or `DIRECTORY.md` orientation, use the `workbench` workspace index with `profile=knowledge` and verify against repository files when consequential.

All native envelopes expose:

- `success`, `error_code`, `error`;
- `cbm_tool`, `binary_version`, `compatibility_status`;
- `duration_ms`, `queue_wait_ms`, `execution_ms`;
- `partial_success`, bounded `warnings`;
- timeout, exit, signal, and truncation fields;
- `result`.

Read `warnings` whenever `partial_success` is true. Stable error codes are the primary classification; `diagnostic` is supporting evidence.

Use `project` as the canonical argument name. `project_name` is accepted as a compatibility alias for upstream CBM v0.9.0 project-scoped tools; if both are supplied, they must be identical or the bridge returns `invalid_project_alias`.

## Tool Selection

| Tool | Use | Key inputs | Operational notes |
|---|---|---|---|
| `cbm_status` | Bridge and binary health | none | Reports executable identity, v0.9.0 manifest compatibility, 14 native tools, allowed root, heavy-read queue, mutation lock, and timeouts. |
| `cbm_list_projects` | Enumerate persisted indexes | none | Never starts indexing. Use returned names exactly. In native v0.9.0, absence can reflect resident-store discovery rather than the full indexed set; confirm before reindexing. |
| `cbm_index_repository` | Create or synchronize an index | `path`; optional `mode`, `name`, `target_projects`, `persistence` | Mutation. Requires an authorized workspace path and explicit authorization. One CBM mutation runs at a time. The bridge snapshots, verifies, and restores existing ADR content when native reindex loses it. A warning on `source_bearing_excluded_dirs` means native discovery skipped a possible source-bearing framework route/module path such as `pages/api/assets` or `src/routes/coverage`. Non-ASCII or whitespace path caveats mean later source/snippet/search absence is not proof of repository absence. |
| `cbm_index_status` | Read one persisted index state | `project` | Distinct from `cbm_status`. A missing project may currently surface as `cbm_native_rejected`; confirm with direct reads and repository truth before reindexing. |
| `cbm_get_architecture` | Read architecture graph | `project`; optional `path`, `aspects` | Never starts indexing. `path` scopes the returned graph. |
| `cbm_search_code` | Graph-augmented text search | `project`, `pattern`; optional file/path filters, regex, mode, context, limit | Never starts indexing. Use `files` mode for discovery and `full` only when context is needed. Non-ASCII or whitespace project/path caveats mean zero matches are not proof of absence. |
| `cbm_search_graph` | Discover symbols and graph nodes | `project`; structural, text, semantic, relationship, degree, and pagination filters | Never starts indexing. Prefer exact `qn_pattern` before snippet or trace operations. Semantic-only calls suppress unfiltered structural `results` and preserve `semantic_results`. |
| `cbm_get_code_snippet` | Read indexed source for one symbol | `project`, `qualified_name`; optional neighbors | Never starts indexing. Discover the qualified name first. Non-ASCII or whitespace project caveats mean source-unavailable output requires repository truth verification. |
| `cbm_trace_path` | Trace calls, data flow, or cross-service paths | `project`, `function_name`; optional direction, depth, mode, parameter, edges, risks, tests | Never starts indexing. Short names can be ambiguous. Empty traces are not proof of no callers for languages with known native call-attribution bugs; verify important absences with `search_graph`/`query_graph`. Parameter-specific data-flow output remains less trustworthy than qualified-name call tracing. |
| `cbm_get_graph_schema` | Inspect labels, edge types, counts, and properties | `project` | Use before custom Cypher. |
| `cbm_query_graph` | Execute bounded read-only Cypher | `project`, `query`; optional `max_rows` | Write clauses are rejected. Prefer labelled source-node patterns. Native `labels()`, inline property maps, `type()`, and unlabeled source relationships with `max_rows` can mislead; bridge caveats mark these partial. |
| `cbm_detect_changes` | Map a Git comparison to changed files, symbols, and impact | `project`; optional `scope`, `depth`, `base_branch`, `since` | Bridge applies normalized path-prefix `scope`. Returns at most 200 changed files and 200 impacted symbols while preserving native, normalized, scoped, returned, and omitted totals in `bridge_analysis`. Empty impacted symbols with changed files means unresolved impact, not no impact; read `impact_resolution_reason`. |
| `cbm_manage_adr` | Read or update project ADR content | `project`; optional `mode`, `content`, `sections` | Conservatively classified as a mutation for every mode. `sections` semantics remain ambiguous; do not invent filtering behavior. |
| `cbm_ingest_traces` | Submit validated runtime traces | `project`, `traces` | Mutation. Required fields: trace ID, span ID, name, start, and end time. Native v0.9.0 may accept the batch while reporting: `Runtime edge creation from traces not yet implemented`; the bridge exposes `runtime_edge_creation`, `runtime_edges_created`, and `runtime_edge_creation_supported`. Treat `runtime_edge_creation: not_implemented` as partial success, not as created graph edges. |
| `cbm_delete_project` | Remove one persisted index | `project`, then `confirm: true` with `state_handle` | Destructive two-phase operation. The handle is short-lived, authenticated, project-bound, and one-time. Only `project` reaches native CBM; the repository source tree is never deleted. Verify the source path independently. |

## Mutation Rules

- Do not index because a read returned no result.
- Do not index outside the authorized root.
- Do not use CBM code-search misses as proof that documentation prose, frontmatter, ADR files, or workflow state does not exist.
- Do not overlap CBM mutations.
- Do not forward, print, persist, or replay a `state_handle`.
- Use deletion only for an explicitly named disposable or operator-approved index.
- After deletion, verify both absence from `cbm_list_projects` and continued source-tree existence.

## Error Semantics

| Error | Meaning and response |
|---|---|
| `cbm_binary_unavailable` | Stop CBM work; inspect `cbm_status`. |
| `cbm_version_incompatible` | Do not trust tool execution; contract version is unsupported. |
| `cbm_contract_mismatch` | Binary/help surface differs from the checked manifest. |
| `cbm_timeout` | Operation exceeded its bounded timeout; inspect mutation/index state before retrying. |
| `cbm_output_limit` | Native output exceeded the bridge limit. Narrow the query or scope. |
| `cbm_invalid_output` | Native output could not be normalized. |
| `cbm_native_rejected` | Native CBM rejected the operation; inspect result and diagnostic. |
| `cbm_project_not_found` | Named delete target does not exist. |
| `cbm_confirmation_required` | First delete phase succeeded; use the returned `state_handle` once in the same authenticated context. |

## Source-of-Truth References

- Tool descriptors: `src/integrations/codebase_memory/cbm_tools.js`
- Input/output schemas: `src/schemas/codebase_memory_tools.js`
- Version manifest: `src/integrations/codebase_memory/contracts/v0.9.0.json`
- Verified behavior and limitations: `docs/CBM_V0_9_0_REBASELINE_REPORT.md`
