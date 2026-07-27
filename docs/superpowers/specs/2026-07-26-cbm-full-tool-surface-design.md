# Codebase-Memory Full Tool Surface Design

Date: 2026-07-26
Status: approved for implementation by direct operator request

## Goal

Expand the authenticated `tests` profile from the validated five-tool CBM bridge MVP to the complete native `codebase-memory-mcp` 0.8.1 tool surface while preserving `mcp-tests` as the only remote MCP server.

The resulting connector surface contains 15 `cbm_*` tools: the 14 native CBM operations plus the bridge-only `cbm_status` diagnostic tool.

## Naming and semantic separation

Every native operation is exposed with a stable `cbm_` prefix and otherwise retains its native name:

1. `cbm_index_repository`
2. `cbm_search_graph`
3. `cbm_query_graph`
4. `cbm_trace_path`
5. `cbm_get_code_snippet`
6. `cbm_get_graph_schema`
7. `cbm_get_architecture`
8. `cbm_search_code`
9. `cbm_list_projects`
10. `cbm_delete_project`
11. `cbm_index_status`
12. `cbm_detect_changes`
13. `cbm_manage_adr`
14. `cbm_ingest_traces`
15. `cbm_status`

`cbm_status` and `cbm_index_status` are deliberately separate:

- `cbm_status` reports bridge exposure, executable discovery, binary version, timeout policy, mutation-lock state, and watcher posture. It takes no project argument.
- `cbm_index_status` invokes the native CBM `index_status` operation for one persisted project. It requires `project`.

No alias named `cmb_status` is introduced; `cmb` is treated as a typo, not a compatibility surface.

## Architecture

The existing private one-shot CLI adapter remains the sole integration path:

```text
mcp-tests authenticated tool
→ strict local input schema
→ fixed operation registry
→ codebase-memory-mcp.exe cli --json <native-tool> <json-arguments>
→ normalized bridge result envelope
```

The caller cannot select an executable, arbitrary native tool name, timeout, shell, or child environment. Tool exposure remains profile-controlled and independent of dependency availability.

## Native contract source

Input contracts follow the 14-tool MCP definitions in the local `codebase-memory-mcp` source snapshot whose package descriptor reports version `0.8.1`. The installed binary version is independently confirmed by `cbm_status` as `0.8.1`.

The wrapper narrows unbounded native inputs with connector-safe limits while preserving field names and semantics. Every input schema uses `additionalProperties: false`.

## Input contracts

### `cbm_index_repository`

Required: `path`, a logical directory inside an authorized workspace root.

Optional:

- `mode`: `full`, `moderate`, `fast`, or `cross-repo-intelligence`; default `full`.
- `target_projects`: bounded array of project names.
- `name`: bounded project-name override.
- `persistence`: boolean; default `false`.

The wrapper resolves `path` through `safeWorkspacePath`, rejects absolute paths, traversal, non-directories, and symlink escapes, then sends the verified absolute path as native `repo_path`.

### Read/query tools

- `cbm_search_graph`: `project` plus bounded BM25, regex, qualified-name, file, relationship, degree, semantic, connected-node, exclusion, limit, and offset fields.
- `cbm_query_graph`: `project`, bounded `query`, optional `max_rows` capped at 100000. The native engine remains the authority for its read-only Cypher subset and rejects write clauses.
- `cbm_trace_path`: `project`, `function_name`, direction, depth 1–5, mode, parameter, edge types, risk labels, and test inclusion.
- `cbm_get_code_snippet`: `project`, `qualified_name`, optional neighbor inclusion.
- `cbm_get_graph_schema`: `project`.
- `cbm_get_architecture`: `project`, optional path scope and bounded aspects.
- `cbm_search_code`: `project`, pattern, file/path filters, mode, context, regex, and bounded result limit.
- `cbm_list_projects`: empty input.
- `cbm_index_status`: `project`.
- `cbm_detect_changes`: `project`, optional scope, depth, base branch, and comparison ref.

### Mutation tools

- `cbm_delete_project`: `project`.
- `cbm_manage_adr`: `project`, optional mode `get|update|sections`, content, and section names.
- `cbm_ingest_traces`: `project` and a bounded array of trace objects.

`cbm_manage_adr` is conservatively classified as a mutation for all modes because MCP annotations and resource policies are static, while the native `get` mode is dynamically read-only.

## Operation classes and timeouts

The fixed operation registry assigns one timeout and mutation class per native tool:

- simple read, 30 seconds: `list_projects`, `index_status`, `get_graph_schema`;
- heavy read, 60 seconds: `search_graph`, `query_graph`, `trace_path`, `get_code_snippet`, `get_architecture`, `search_code`, `detect_changes`;
- bounded mutation, 60 seconds: `delete_project`, `manage_adr`, `ingest_traces`;
- repository indexing, 10 minutes by default with a 30-minute hard ceiling: `index_repository`.

The caller cannot increase these limits.

## Concurrency

One process-local exclusive mutation lock covers:

- `index_repository`;
- `delete_project`;
- `manage_adr`;
- `ingest_traces`.

A second mutation receives structured `mutation_busy` without spawning the binary. Read operations remain available while a mutation is running, matching the current MVP behavior for reads during indexing.

`cbm_status` reports:

- `index_busy` for backward compatibility;
- `mutation_busy`;
- `active_mutation_tool`, or an empty string when idle.

## Security and policy classification

All 15 tools are present only on `tests.authenticated` and absent from the public surface.

Read-only policy:

- `cbm_status`
- `cbm_list_projects`
- `cbm_search_graph`
- `cbm_query_graph`
- `cbm_trace_path`
- `cbm_get_code_snippet`
- `cbm_get_graph_schema`
- `cbm_get_architecture`
- `cbm_search_code`
- `cbm_index_status`
- `cbm_detect_changes`

Audited non-destructive mutation policy:

- `cbm_index_repository`
- `cbm_manage_adr`
- `cbm_ingest_traces`

Audited destructive policy:

- `cbm_delete_project`

Returned source snippets, graph rows, ADR content, trace payloads, and full query text must not be copied into audit summaries. Summaries contain operation name, project/path metadata, filter counts, bounded lengths, and result-size statistics only.

## Tool-surface accounting

The repository target changes by ten tools:

- public core: unchanged;
- public optional/profile surface: unchanged;
- authenticated authorized tools: 61 → 71;
- authenticated total MCP-callable tools: 74 → 84;
- authenticated optional tools: 72 → 82.

Live runtime remains 74 until the controlled restart and operator connector refresh complete.

## Testing strategy

### Hermetic tests

A fake executable verifies all 14 native operation names, exact JSON argument forwarding, timeout classes, output normalization, version probing, mutation locking, path validation, and error classification.

Contract tests verify:

- all 15 descriptors and schemas;
- no caller-controlled executable, timeout, or arbitrary operation;
- static annotations and policy classes;
- no implicit indexing from any read operation;
- `cbm_status` remains distinct from `cbm_index_status`;
- obsolete CBM exposure flags have no effect;
- public exclusion and authenticated inclusion even when the executable is unavailable.

### Live fixture validation

After repository validation, controlled restart, and operator connector refresh, create or use a dedicated tiny fixture repository under an authorized workspace root. Validate:

1. `cbm_status`;
2. `cbm_index_repository` on the fixture only;
3. `cbm_list_projects` and `cbm_index_status`;
4. all read/query tools against the fixture project;
5. `cbm_manage_adr` and `cbm_ingest_traces` only against that fixture;
6. `cbm_delete_project` only for the dedicated fixture index, as final cleanup.

No existing operator project may be deleted or modified for validation.

## Rollout

1. Add failing full-surface contract and bridge tests.
2. Implement schemas, registry entries, tool descriptors, facades, loader, policies, and profile resources.
3. Update canonical specs, workflow truth, count-sensitive tests, and directory documentation.
4. Run targeted tests, full offline smoke suite, syntax checks, JSON parsing, server self-test, and `git diff --check`.
5. Request restart only with:

```powershell
node .\scripts\request-restart.js --code=42 --reason=manual
```

6. Report the request; the operator refreshes the ChatGPT connector.
7. After explicit refresh confirmation, verify live count 84 and run the dedicated-fixture validation sequence.
