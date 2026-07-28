---
name: using-codebase-memory
description: Use when a task requires inspecting, indexing, searching, querying, tracing, comparing, or deleting repositories through TEST MCP cbm_* tools, or when interpreting codebase-memory v0.9.0 results and limitations.
---

# Using Codebase Memory

## Overview

Use CBM as indexed evidence, not a substitute for repository files or live runtime inspection. Select the narrowest `cbm_*` tool and preserve truth-layer boundaries.

## Core Contract

- **Repository truth:** current files and Git state.
- **Index truth:** the latest completed CBM index; it may be stale.
- **Runtime truth:** active bridge, executable, queues, and mutation lock.
- **Client/UI truth:** connector enumeration and approval behavior.
- Read operations never index implicitly.
- Index only with explicit operator authorization.

## Default Workflow

1. Call `cbm_status` when compatibility, queue state, or binary identity is uncertain.
2. Call `cbm_list_projects`; use the exact persisted project name.
3. Choose the narrowest read tool. Do not index merely because discovery says a project is missing or stale.
4. Use `cbm_index_repository` only for an authorized path and authorized indexing task.
5. Inspect `success`, `error_code`, `partial_success`, `warnings`, `queue_wait_ms`, and `execution_ms`.
6. Verify consequential findings against repository or runtime truth.

Prefer the descriptor's `project` argument. The bridge also accepts upstream `project_name`; both fields must match if both are supplied.

## Quick Reference

| Need | Tool path |
|---|---|
| Health or compatibility | `cbm_status` |
| Existing indexes | `cbm_list_projects` → `cbm_index_status` |
| Architecture | `cbm_get_architecture` |
| Text/source search | `cbm_search_code` |
| Symbol discovery | `cbm_search_graph` |
| Exact source | `cbm_search_graph` → `cbm_get_code_snippet` |
| Calls/data flow | `cbm_search_graph` → `cbm_trace_path` |
| Graph query | `cbm_get_graph_schema` → `cbm_query_graph` |
| Git impact | `cbm_detect_changes` |
| ADR or traces | `cbm_manage_adr`, `cbm_ingest_traces` |
| Remove index | `cbm_delete_project` |

Load `references/tools.md` for arguments and caveats. Load `references/scenarios.md` for decision cases.

## Safety Boundaries

- Treat indexing, ADR access, trace ingestion, and deletion as mutations.
- Delete only a named disposable index. Use `state_handle`; never log or reuse it.
- Index deletion never authorizes source deletion.
- Do not use write Cypher. Treat suspicious `labels()` aggregation as unverified.
- Do not claim freshness beyond the latest completed index.

## Result Interpretation

`success: true` with `partial_success: true` is not full success. Prefer structured fields over warning prose. For `cbm_detect_changes`, read `bridge_analysis`, totals, and `impact_resolution_reason`; bounded arrays are samples. For `cbm_ingest_traces`, `runtime_edge_creation: not_implemented` means accepted transport only. Treat discovery absence, semantic-only suppression, `source_bearing_excluded_dirs`, Cypher caveats, and Windows non-ASCII pattern, path, or project caveats as citation and coverage warnings. `queue_wait_ms` is scheduling delay. Stable bridge errors outrank diagnostic text.

## Common Mistakes

- Inventing a project name instead of listing projects.
- Using short ambiguous symbols when a qualified name is available.
- Treating an empty scoped result as proof that no repository change exists.
- Treating accepted trace ingestion as created runtime edges.
- Confusing fifteen `cbm_*` tools with fourteen native CBM operations.
