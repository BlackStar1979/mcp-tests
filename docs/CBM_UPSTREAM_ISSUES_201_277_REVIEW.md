# CBM Upstream Issues 201-277 Review

Date: 2026-07-29

Source: [DeusData/codebase-memory-mcp open issues sorted by newest](https://github.com/DeusData/codebase-memory-mcp/issues?q=is%3Aissue%20is%3Aopen%20sort%3Acreated-desc). Current snapshot: 277 open issues from GitHub REST, archived under `_logs/upstream-codebase-memory-open-issues-current-index-2026-07-29T16-16-10-949Z.json`. Selected comments for local-impact issues are archived under `_logs/upstream-codebase-memory-open-issues-201-277-selected-comments-2026-07-29T16-16-35-566Z.json`.

## Batch Summary

This batch reinforces that local `mcp-tests` should keep CBM as the code-graph layer and avoid pretending it is a documentation index, workflow memory, process-flow engine, or native parser replacement. The locally actionable work is skill/routing clarity: code questions go through `cbm_*`; documentation and workflow questions go through the `workbench` knowledge index and repository files.

## Applied Locally

- Upstream issues [#490](https://github.com/DeusData/codebase-memory-mcp/issues/490), [#518](https://github.com/DeusData/codebase-memory-mcp/issues/518), [#519](https://github.com/DeusData/codebase-memory-mcp/issues/519), [#507](https://github.com/DeusData/codebase-memory-mcp/issues/507), and [#504](https://github.com/DeusData/codebase-memory-mcp/issues/504) show unresolved demand for document, Markdown, frontmatter, and ADR indexing in native CBM. Local guidance now routes documentation, workflow, specs, reports, and `DIRECTORY.md` orientation questions to `workbench` `profile=knowledge` instead of CBM.
- Upstream issue [#597](https://github.com/DeusData/codebase-memory-mcp/issues/597) asks for execution-flow or process abstraction. Local guidance does not invent that feature: agents should compose `cbm_search_graph`, `cbm_trace_path`, and `cbm_query_graph` for code flow, and should report missing first-class process abstraction as a native limitation.
- Upstream issues [#480](https://github.com/DeusData/codebase-memory-mcp/issues/480), [#514](https://github.com/DeusData/codebase-memory-mcp/issues/514), [#523](https://github.com/DeusData/codebase-memory-mcp/issues/523), and [#440](https://github.com/DeusData/codebase-memory-mcp/issues/440) reinforce existing local trace/cross-edge caveats: empty trace or cross-repo output is indexed evidence only, not proof of absence.

## Already Covered Or Bounded

- Issues [#581](https://github.com/DeusData/codebase-memory-mcp/issues/581), [#580](https://github.com/DeusData/codebase-memory-mcp/issues/580), [#563](https://github.com/DeusData/codebase-memory-mcp/issues/563), [#524](https://github.com/DeusData/codebase-memory-mcp/issues/524), [#474](https://github.com/DeusData/codebase-memory-mcp/issues/474), [#363](https://github.com/DeusData/codebase-memory-mcp/issues/363), and [#45](https://github.com/DeusData/codebase-memory-mcp/issues/45) remain native performance/resource concerns. The local bridge already bounds subprocess execution, exposes timeout/exit/signal/truncation fields, serializes mutations, and records queue timing.
- Issues [#557](https://github.com/DeusData/codebase-memory-mcp/issues/557), [#391](https://github.com/DeusData/codebase-memory-mcp/issues/391), [#390](https://github.com/DeusData/codebase-memory-mcp/issues/390), [#333](https://github.com/DeusData/codebase-memory-mcp/issues/333), and [#317](https://github.com/DeusData/codebase-memory-mcp/issues/317) reinforce the local rule that `success` and `status:indexed` are not enough. Agents must inspect `partial_success`, warnings, graph counts, stable bridge errors, and repository truth.
- Issues [#520](https://github.com/DeusData/codebase-memory-mcp/issues/520) and [#335](https://github.com/DeusData/codebase-memory-mcp/issues/335) reinforce the existing no-implicit-index rule. A changed file, new file, stale watcher, or missing project is not authorization to reindex.
- Issues [#585](https://github.com/DeusData/codebase-memory-mcp/issues/585), [#509](https://github.com/DeusData/codebase-memory-mcp/issues/509), and [#330](https://github.com/DeusData/codebase-memory-mcp/issues/330) reinforce project-local skill guidance and session-start reminders. The local skill now makes the code-vs-documentation boundary explicit.

## Deferred

- Do not add native parser compensation for dbt, SQL DDL, SwiftPM, Julia, C++, Terraform, GitHub Actions, Rust LSP, Vue/React callbacks, or cross-crate extraction reports in this batch. Those require native CBM extraction work.
- Do not add a local process-flow abstraction over `trace_path` yet. Without a native model for derivation, storage, invalidation, and display, that would become misleading agent prose rather than reliable evidence.
- Do not make CBM the documentation index. `workbench` already owns the local documentation-first knowledge index and exposes workflow-summary fields.

## Acceptance Criteria

- The `using-codebase-memory` skill routes documentation/workflow questions to `workbench` knowledge retrieval.
- The CBM tool reference warns that CBM code-search misses do not prove Markdown/frontmatter/ADR/workflow absence.
- The scenario reference includes a documentation/workflow case.
- `smoke_cbm_agent_skill` guards the new boundary.
- Full `run_all_smokes --skip-network` remains green before commit.
