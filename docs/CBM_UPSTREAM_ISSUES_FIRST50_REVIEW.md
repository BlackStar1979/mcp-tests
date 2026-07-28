# CBM Upstream Issues First-50 Review

Date: 2026-07-28

Source snapshot: `_logs/upstream-codebase-memory-open-issues-first50-2026-07-28T04-48-27-403Z.json`

Repository reviewed: `DeusData/codebase-memory-mcp`

Scope: first 50 open GitHub issues sorted by newest creation date, including issue bodies and available comments. GitHub reported 278 open issues at fetch time; the first-50 snapshot contained 30 comments.

## mcp-tests Impact Summary

The first-50 upstream issue set contains four classes relevant to the `mcp-tests` CBM bridge:

- Agent-output safety and token/citation risk: semantic-only `search_graph` returning unfiltered structural `results` (#1295), broad token usage complaints (#1301), and tool-count confusion (#1297).
- Indexed coverage caveats that bridge users must not treat as complete graph truth: source-bearing route directories excluded by native discovery (#1219), stale/weak metadata in native index responses (#1287, #1273, #1213), and stale watcher/session behavior (#1296).
- Native graph correctness bugs that the bridge cannot repair without a new CBM binary: parser/resolution issues across Python, Java, Go, TypeScript, C++, ObjectScript, PHP, Haskell, and Glimmer (#1294, #1293, #1292, #1286, #1284, #1283, #1278, #1277, #1276, #1271, #1266, #1265, #1262, #1261, #1260, #1250, #1249, #1248, #1237, #1234, #1233, #1231, #1220, #1212).
- Upstream distribution/UI/integration concerns that are not `mcp-tests` server behavior: Windows installer/archive mismatch (#1290, #1257, #1218), Windows build/Git-discovery defects (#1267, #1240, #1225), UI loading (#1216), MiMoCode integration (#1217), semantic backend evaluation (#1238), and multi-tenancy (#1256).

## Applied in mcp-tests

| Upstream issue | Risk for mcp-tests | Local action |
| --- | --- | --- |
| #1295 | `search_graph` with only `semantic_query` may include an unfiltered structural graph dump in `results`, causing token waste and citation hazards. | Bridge now suppresses structural `results` for semantic-only calls, preserves `semantic_results`, adds `semantic_only_structural_results_suppressed`, totals, `bridge_analysis`, and a warning. Covered by `_tests/smoke_cbm_cli_bridge.js`. |
| #1219 | Native discovery can exclude source-bearing framework route directories such as `pages/api/assets`; agents may miss live API handlers. | Bridge now warns and exposes `source_bearing_excluded_dirs` / count when native `index_repository.excluded.dirs` matches known source-bearing API-route asset paths. Covered by `_tests/smoke_cbm_cli_bridge.js`. |

## Already Covered or Not a Local Defect

| Upstream issue | mcp-tests status |
| --- | --- |
| #1297 | `mcp-tests` explicitly models 14 native CBM operations plus bridge-only `cbm_status` as 15 connector tools. Existing specs and skill guidance already avoid treating `semantic_query` as a standalone tool. |
| #1292 | The bridge already marks suspicious `labels()` aggregation results as partial and warns callers. |
| #1247 | Maintainer and reporter confirmed direct CBM pagination terminates correctly; the observed infinite pagination came from `mcp-proxy`. `mcp-tests` has its own tool-list/cache pagination guards. |
| #1301 | Token usage risk is addressed locally by bounded outputs, warning normalization, result suppression for semantic-only structural dumps, and skill guidance to choose narrow tools. |
| #1296 | Native watcher staleness is not introduced by the bridge because `mcp-tests` read calls execute the verified CLI and never rely on implicit indexing. Operators still need explicit `cbm_index_repository` when freshness matters. |
| #1256 | Upstream's local-user security model does not transfer directly to `mcp-tests`; this server wraps CBM behind its own OAuth/profile/policy surface and does not expose native multi-tenant CBM state directly. |

## Deferred Backlog for mcp-tests

| Upstream issue | Why deferred | Possible future local action |
| --- | --- | --- |
| #1273 | Native mode-capability retention cannot be proven from current bridge metadata alone. | If native exposes stored index mode/capability, add a bridge warning or rebuild policy when requested mode is stronger than the stored capability. |
| #1287 | Parse-partial counts are native response truth; bridge cannot reconstruct complete parse coverage without a native coverage API. | Prefer `index_status` / missed graph evidence over `index_repository.parse_partial_count` once native output exposes stable fields. |
| #1213 | Branch metadata is native graph content; bridge can reindex but cannot repair `Branch.head_sha` safely without mutating the graph database directly. | Add a warning if native exposes contradictory HEAD metadata in `index_status` or query output. |
| #1300, #1241, #1265, #1231 | These are large-project or scanner resource failures in native indexing. | Keep bridge timeouts, mutation lock, output limits, and explicit error envelopes; add corpus-specific stress only when a matching local fixture exists. |

## Upstream-Only Findings

Most first-50 issues are native parser, resolver, installer, UI, or integration requests. They inform bridge skepticism but should not be patched in `mcp-tests` as if the bridge owned CBM internals. The current local rule is:

- Do not claim graph completeness for parser-sensitive languages when upstream has open high-priority extraction bugs.
- Verify important findings against repository truth, especially routes, call paths, Java interface edges, Python dynamic dispatch, TypeScript arrow handlers, ObjectScript embedded Python, and HTTP/service-call edges.
- Prefer bridge structured warnings and metadata over native prose, but do not treat bridge compensation as a fix for native graph correctness.

## Reviewed Issue Numbers

Reviewed: #1311, #1302, #1301, #1300, #1299, #1297, #1296, #1295, #1294, #1293, #1292, #1290, #1287, #1286, #1284, #1283, #1278, #1277, #1276, #1273, #1271, #1267, #1266, #1265, #1264, #1262, #1261, #1260, #1257, #1256, #1251, #1250, #1249, #1248, #1247, #1241, #1240, #1238, #1237, #1234, #1233, #1231, #1225, #1220, #1219, #1218, #1217, #1216, #1213, #1212.
