# CBM Upstream Issues 101-150 Review

Date: 2026-07-28

Source: [DeusData/codebase-memory-mcp open issues sorted by newest](https://github.com/DeusData/codebase-memory-mcp/issues?q=is%3Aissue%20is%3Aopen%20sort%3Acreated-desc). GitHub REST was unavailable from this environment due unauthenticated rate limiting, so the issue index was extracted from the page `react-app.embeddedData` payload and archived under `_logs/`.

## Batch Summary

The current open issue count observed during review was 279. Ordinals 101-150 overlap heavily with issues already reviewed in the 51-100 batch because new upstream issues shifted the pagination window. The new local value is concentrated in Windows path encoding, project naming discipline, and large-store operational caveats.

## Applied Locally

- Upstream issue [#903](https://github.com/DeusData/codebase-memory-mcp/issues/903), plus the related non-ASCII path pattern already seen in the 51-100 batch, is now reflected in bridge output. On Windows, `cbm_index_repository` returns `non_ascii_index_path_windows_caveat` when the requested repository path contains non-ASCII text.
- `cbm_search_code` and `cbm_get_code_snippet` now return `non_ascii_project_windows_caveat` when the `project` or `project_name` identifier contains non-ASCII text. This makes path-derived project-name risk explicit instead of letting false-empty or source-unavailable results look authoritative.
- The `using-codebase-memory` skill and tool reference now instruct agents to treat Windows non-ASCII pattern, path, and project caveats as coverage warnings requiring repository-truth verification.

## Already Covered By Existing Bridge Behavior

- Issues such as [#1115](https://github.com/DeusData/codebase-memory-mcp/issues/1115), [#1116](https://github.com/DeusData/codebase-memory-mcp/issues/1116), and [#1066](https://github.com/DeusData/codebase-memory-mcp/issues/1066) remain covered by resident-set caveats: `cbm_list_projects` and `cbm_index_status` are not treated as absence proof.
- Issues such as [#1111](https://github.com/DeusData/codebase-memory-mcp/issues/1111) remain covered by Cypher caveats for unsupported or misleading query shapes.
- Issues such as [#1068](https://github.com/DeusData/codebase-memory-mcp/issues/1068) and [#965](https://github.com/DeusData/codebase-memory-mcp/issues/965) are bounded by the bridge process envelope: timeouts, output limits, stable `error_code`, and diagnostic truncation.
- Issues such as [#1037](https://github.com/DeusData/codebase-memory-mcp/issues/1037), [#1083](https://github.com/DeusData/codebase-memory-mcp/issues/1083), and [#1084](https://github.com/DeusData/codebase-memory-mcp/issues/1084) are partially mitigated by one-at-a-time bridge mutations and no implicit indexing from read tools. Native WAL/cache internals are still upstream concerns.
- Issue [#885](https://github.com/DeusData/codebase-memory-mcp/issues/885) reinforces the existing local rule: pass and preserve exact persisted project names, and use explicit names for disposable or path-sensitive indexes.

## Deferred

- Add optional CBM store-health telemetry to `cbm_status` if a reproducible local WAL/cache growth case appears.
- Add a targeted semantic-ranking caveat only if local testing reproduces [#915](https://github.com/DeusData/codebase-memory-mcp/issues/915) in the native version used by the bridge.
- Revisit cross-repository identity caveats for [#953](https://github.com/DeusData/codebase-memory-mcp/issues/953) when cross-repo graph use becomes a product requirement.

## Acceptance Criteria

- `smoke_cbm_cli_bridge` covers Windows non-ASCII repository-path and project-identifier caveats.
- `smoke_cbm_specs` asserts the bridge contract fields for the new caveats.
- `smoke_cbm_agent_skill` keeps the operator-facing skill compact while documenting the interpretation rule.
