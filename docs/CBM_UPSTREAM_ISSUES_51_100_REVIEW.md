# CBM Upstream Issues 51-100 Review

Date: 2026-07-28

Repository reviewed: `DeusData/codebase-memory-mcp`

Scope: open GitHub issues ranked 51-100 by newest-first issue ordering after the first-50 review.

Sources:

- `_logs/upstream-codebase-memory-open-issues-51-100-index-2026-07-28T15-11-18-564Z.json`
- `_logs/upstream-codebase-memory-open-issues-51-100-2026-07-28T15-07-00-628Z.json`
- GitHub issue comments fetched for high-impact issues #1211, #1209, #1206, #1205, #1196, #1195, #1171, #1165, #1115, #1111, and #965.

GitHub reported 278 open issues during the review window. The local detailed API snapshot covered only part of this ordinal range, so lower-impact tail items were classified from the HTML index and targeted issue/comment reads rather than from a full second API export.

## mcp-tests Impact Summary

The second issue set reinforces that `mcp-tests` should treat native CBM v0.9.0 as an indexed evidence provider with explicit caveats, not as complete source truth:

- Windows text and path encoding can produce false zero matches or failed persistence under non-ASCII content, profiles, cache paths, and CJK paths (#1209, #1171, #1165).
- Native discovery can exclude source-bearing framework route directories because broad skip basenames are applied too deeply (#1205).
- Native Cypher support can silently return empty or fabricated-looking rows for unsupported shapes (#1196, #1111).
- Discovery APIs can report resident/open stores rather than the full indexed set after store eviction (#1115).
- Large stores and discovery paths can hang or time out (#1195, #1172, #965).

## Applied in mcp-tests

| Upstream issue | Risk for mcp-tests | Local action |
| --- | --- | --- |
| #1205 | A skipped basename such as `assets`, `coverage`, or `vendor` inside route/module paths can hide source-bearing handlers. | `cbm_index_repository` now flags `source_bearing_excluded_dirs` for broader framework route/module paths such as `pages/api/assets`, `src/routes/coverage`, and `routes/vendor`. Covered by `_tests/smoke_cbm_cli_bridge.js`. |
| #1209 | On Windows, native `search_code` can return false zero matches for non-ASCII patterns because the content path transcodes UTF-8 through the ANSI codepage. | `cbm_search_code` now adds a Windows non-ASCII caveat and `bridge_analysis.windows_search_code_utf8_caveat` when a non-ASCII pattern is searched on Windows. Covered by `_tests/smoke_cbm_cli_bridge.js`. |
| #1196 | `query_graph` with an unlabeled source relationship pattern and `max_rows` can silently return empty or partial results. | `cbm_query_graph` now marks this shape with `cypher_unlabeled_source_limit_caveat` and `bridge_analysis.cypher_caveats`. Covered by `_tests/smoke_cbm_cli_bridge.js`. |
| #1111 | Inline property maps and `type()` in native Cypher can silently produce misleading empty or fabricated-looking results. | `cbm_query_graph` now marks inline property maps and `type()` with explicit caveats and warnings. Covered by `_tests/smoke_cbm_cli_bridge.js`. |
| #1115 | `list_projects` and `index_status` can reflect the resident set instead of the full indexed set after eviction. | Specs and the `using-codebase-memory` skill now treat discovery absence as not proof of index absence and warn against automatic reindexing. Covered by `_tests/smoke_cbm_specs.js` and `_tests/smoke_cbm_agent_skill.js`. |

## Already Covered or Not a Local Defect

| Upstream issue | mcp-tests status |
| --- | --- |
| #1211 | `mcp-tests` exposes `cbm_index_repository` as an authorized path-based mutation. Project-only reindex remains a native diagnostic/integration defect, not a local bridge contract. |
| #1206, #1037 | The bridge does not run multiple native MCP watcher instances; it shells out through bounded CLI calls and serializes mutations. Native store quarantine remains upstream, but local architecture avoids the reported concurrent server pattern. |
| #1195, #1172, #965 | The bridge already has per-tool timeouts, heavy-read queueing, mutation serialization, output limits, and timing fields. These issues still justify larger stress tests, but no unbounded local call path was found in this review. |
| #1155 | The skill and reference docs already separate text/source search from semantic graph search and require repository-truth verification for consequential findings. |
| #1100 | `mcp-tests` already owns its authenticated/public tool profile and explicit CBM tool surface instead of exposing native CBM wholesale. |
| #1117, #1119, #1118, #1116, #1113 | These watcher/SVN lifecycle issues do not map directly because local CBM reads do not rely on native watcher publication. |

## Deferred Backlog for mcp-tests

| Upstream issue | Why deferred | Possible future local action |
| --- | --- | --- |
| #1171, #1165 | Non-ASCII Windows paths can break native persistence/cache handling, but the bridge cannot repair native path decoding. | Add a Windows startup diagnostic if `CBM_ALLOWED_ROOT`, `CBM_CACHE_DIR`, `CBM_CONFIG_DIR`, or the profile-derived default cache path contains non-ASCII characters while native CBM is still v0.9.0. |
| #1199 | Extensionless executable scripts with valid shebangs can be skipped by native discovery. | Add a coverage caveat if native excluded/skipped output exposes extensionless source files, or add a local fixture once native output format is stable. |
| #1153, #1147, #1146, #1114, #1095, #1091, #1041, #1009, #1006, #969 | Parser/resolver coverage gaps are native graph correctness issues. | Track as graph-completeness caveats in readiness; verify important call/path/route claims against repository truth. |
| #962, #862 | Feature requests for more filetypes/export capabilities. | Consider only after core v0.9.0 bridge stability and stress testing are complete. |

## Upstream-Only Findings

Issues focused on native installer, UI, distribution, or test-suite behavior do not require local bridge changes now: #1210, #1202, #1200, #1198, #1197, #1170, #1168, #1167, #1161, #1053, #1038, #1020, #976, #975, and #850.

## Reviewed Issue Numbers

Reviewed/classified: #1211, #1210, #1209, #1206, #1205, #1202, #1200, #1199, #1198, #1197, #1196, #1195, #1172, #1171, #1170, #1168, #1167, #1165, #1161, #1155, #1153, #1147, #1146, #1145, #1117, #1119, #1118, #1116, #1115, #1114, #1113, #1112, #1111, #1100, #1095, #1091, #1053, #1041, #1038, #1037, #1020, #1009, #1006, #976, #975, #969, #965, #962, #862, #850.
