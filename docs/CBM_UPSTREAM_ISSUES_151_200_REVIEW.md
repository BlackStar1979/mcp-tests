# CBM Upstream Issues 151-200 Review

Date: 2026-07-28

Source: [DeusData/codebase-memory-mcp open issues sorted by newest](https://github.com/DeusData/codebase-memory-mcp/issues?q=is%3Aissue%20is%3Aopen%20sort%3Acreated-desc). GitHub REST remained unavailable from this environment due unauthenticated rate limiting, so ordinals 151-200 were extracted from the GitHub page embedded data for pages 7-8 and archived under `_logs/`.

## Batch Summary

This batch is mostly native codebase-memory quality, parser, watcher, and UI work. The local `mcp-tests` bridge should not attempt to reimplement native parsing or store internals. The useful local action is to make known silent-false-empty conditions explicit in the bridge envelope and agent guidance.

## Applied Locally

- Upstream issue [#679](https://github.com/DeusData/codebase-memory-mcp/issues/679) reports `search_code` returning false zero matches after indexing a repository from a path containing spaces. The bridge now returns `path_with_space_index_path_caveat` on `cbm_index_repository` for whitespace paths.
- `cbm_search_code` and `cbm_get_code_snippet` now return `project_with_space_caveat` when the project identifier contains whitespace. This covers explicit names and path-derived project identifiers that could inherit the same native search/source risk.
- The `using-codebase-memory` skill and tool reference now instruct agents to treat whitespace path/project caveats as coverage warnings, not as proof of absence.

## Already Covered Or Bounded

- Issues [#867](https://github.com/DeusData/codebase-memory-mcp/issues/867), [#841](https://github.com/DeusData/codebase-memory-mcp/issues/841), [#832](https://github.com/DeusData/codebase-memory-mcp/issues/832), [#775](https://github.com/DeusData/codebase-memory-mcp/issues/775), and [#713](https://github.com/DeusData/codebase-memory-mcp/issues/713) reinforce the existing bridge stance: reads never trigger indexing, indexing is explicit, one bridge mutation runs at a time, and indexing has bounded timeouts. Native incremental-cost, watcher-churn, and memory-retention behavior stay upstream concerns.
- Issue [#790](https://github.com/DeusData/codebase-memory-mcp/issues/790) reinforces resident-store caution. `cbm_list_projects` is not treated as proof that every read operation is queryable; read failures keep stable `error_code`, diagnostic, and native result context.
- Issues [#627](https://github.com/DeusData/codebase-memory-mcp/issues/627) and related query/runtime crashes are bounded by the child-process envelope: timeout, exit code, signal, truncation, and `cbm_native_rejected`/`cbm_invalid_output` classification.
- Issue [#612](https://github.com/DeusData/codebase-memory-mcp/issues/612) is already covered: `cbm_ingest_traces` exposes `runtime_edge_creation=not_implemented`, `runtime_edges_created=0`, and partial success when native accepts traces without creating runtime edges.

## Deferred

- Do not add native parser compensations for [#763](https://github.com/DeusData/codebase-memory-mcp/issues/763), [#759](https://github.com/DeusData/codebase-memory-mcp/issues/759), [#734](https://github.com/DeusData/codebase-memory-mcp/issues/734), [#706](https://github.com/DeusData/codebase-memory-mcp/issues/706), [#694](https://github.com/DeusData/codebase-memory-mcp/issues/694), [#686](https://github.com/DeusData/codebase-memory-mcp/issues/686), [#678](https://github.com/DeusData/codebase-memory-mcp/issues/678), or [#606](https://github.com/DeusData/codebase-memory-mcp/issues/606) in `mcp-tests`; they require native extraction fixes. Local guidance now tells agents not to treat empty `trace_path` as authoritative for languages with known call-attribution bugs.
- Do not add a runtime `get_architecture` warning for [#725](https://github.com/DeusData/codebase-memory-mcp/issues/725) yet. It is better handled as interpretation guidance: verify important hotspot `fan_in` claims against `query_graph` before citing them as exact.
- UI-only and installer/editor integration issues in this batch do not affect the `mcp-tests` bridge surface.

## Acceptance Criteria

- `smoke_cbm_cli_bridge` covers whitespace path and project caveats.
- `smoke_cbm_specs` asserts the new bridge contract fields.
- `smoke_cbm_agent_skill` guards the updated interpretation guidance.
- Full `run_all_smokes --skip-network` remains green before commit.
