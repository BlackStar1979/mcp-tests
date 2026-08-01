---
name: using-codebase-memory
description: Use when a task requires inspecting, indexing, searching, querying, tracing, comparing, or deleting repositories through TEST MCP cbm_* tools, or when interpreting codebase-memory v0.9.0 results and limitations.
---

# Using Codebase Memory

## Overview

Use CBM as indexed code evidence. Keep repository, runtime, documentation, and UI truth separate.

## Core Contract

- **Repository truth:** current files and Git state.
- **Index truth:** the latest completed CBM code graph; it may be stale.
- **Knowledge index truth:** `workbench` documentation/workflow retrieval; use it for docs, plans, specs, and project-state questions.
- **Runtime truth:** active bridge, executable, queues, and mutation lock.
- **Client/UI truth:** connector enumeration and approval behavior.
- Read operations never index implicitly.
- Index only with explicit operator authorization.
- Require `freshness.status=fresh` for current knowledge claims; rebuild an authorized stale or unknown scope first.

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
| Documentation or workflow state | `workbench` `index_status` / `build_index(profile=knowledge)` |
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

`references/tools.md` covers contracts; `references/scenarios.md` covers decisions. Load only when needed.

## Safety Boundaries

- Treat indexing, ADR access, trace ingestion, and deletion as mutations.
- Delete only a named disposable index. Use `state_handle`; never log or reuse it.
- Index deletion never authorizes source deletion.
- Do not use write Cypher. Treat suspicious `labels()` aggregation as unverified.
- Do not claim freshness beyond the latest completed index.

## Result Interpretation

`partial_success` is not full success. Prefer structured fields: `bridge_analysis`, totals, and `impact_resolution_reason` for changes; `runtime_edge_creation` for traces. Arrays may be samples. Snippets must contain the symbol; `source_integrity: bridge_recovered` is repository-backed, while `source_reliable: false` requires file verification. Treat discovery absence, `source_bearing_excluded_dirs`, Windows non-ASCII, whitespace path/project caveats, and Cypher caveats as coverage warnings. `queue_wait_ms` is scheduling delay.

Knowledge `fresh` covers indexed files and visited directories; changed/missing samples explain staleness. Canonical extraction is full but bounded and transient; persisted samples stay bounded.

## Common Mistakes

- Inventing a project name instead of listing projects.
- Trusting snippet line metadata when the returned source does not contain the requested symbol.
- Treating an empty scoped result as proof that no repository change exists.
- Treating accepted trace ingestion as created runtime edges.
