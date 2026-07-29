# CBM Reliability Hardening Report

Date: 2026-07-27
Status: repository, native-cache repair, controlled restart, connector refresh, and live verification GREEN

## Scope

This package repaired defects discovered through live `cbm_*` analysis of `C:\Work\mcp-tests` without changing the connector-visible surface. The expected surface remains 84 tools: 13 public and 71 authorized-visible, including 15 `cbm_*` tools.

No source repository was deleted or reindexed during cache-schema repair. The final live load used controlled restart request `manual-1785110528926`; no process was started, stopped, or replaced outside supervisor authority. No commit or push was performed.

## Repository behavior changes

### Native payload transport

`src/integrations/codebase_memory/cbm_cli_bridge.js` now invokes native CBM as:

```text
cli --json <tool>
```

and writes the UTF-8 JSON payload to child stdin. Schema-valid large ADR and trace requests no longer depend on the Windows argv length limit. A regression test sends a 120,000-character ADR body and verifies that the payload reaches the native fixture without appearing in argv.

### Change-result normalization

`detect_changes` output is normalized before scope filtering and connector bounding:

- path separators are canonicalized;
- changed files are deduplicated, case-insensitively on Windows;
- impacted symbols are deduplicated by stable symbol/file identity;
- native totals remain visible;
- connector totals describe normalized unique results;
- duplicate removal emits a bounded warning.

### Fail-fast runtime output configuration

`src/runtime/runtime_output_config.js` validates `MCP_TEST_OUTPUT_MODE` and `MCP_TEST_FETCH_CAP_CHARS` before profile mutation, OAuth construction, logger creation, restart-controller startup, or tool-surface persistence. Invalid configuration exits with code 2 and creates no configured audit, state, restart, or rate-limit artifacts.

### Portable executable resolution

The operator-specific fallback path was removed. On Windows, the final fallback is `codebase-memory-mcp.exe`, allowing normal PATH resolution instead of embedding a concrete user profile.

### ADR-preserving reindex gate

Existing-project indexing now fails closed with `cbm_adr_snapshot_unavailable` when ADR retrieval fails or returns a malformed response. A successfully read empty ADR remains a valid snapshot and is represented by:

```text
adr_snapshot_available: true
adr_snapshot_nonempty: false
```

### Shared OAuth/HTTP helpers

Exact duplicate implementations were consolidated without changing public module APIs:

- `parseOAuthStateBody` and `choosePreferredRefreshToken` moved to `src/auth/oauth21_state_helpers.js`;
- `jsonResponse` moved to `src/util/http_response_helpers.js`;
- `src/runtime/http_responses.js` and `src/auth/oauth21_utils.js` reuse the same canonical response helper.

Near-duplicates with different backend or lifecycle semantics were intentionally retained.

## Native cache schema repair

### Root cause

All three active native cache databases were structurally valid SQLite databases but used the pre-v0.9.0 `edges` schema. They lacked generated column `local_name_gen` and still used uniqueness over:

```text
(source_id, target_id, type)
```

Native v0.9.0 `manage_adr` requires:

```text
local_name_gen GENERATED ALWAYS AS (
  CASE WHEN type='IMPORTS'
    THEN coalesce(json_extract(properties,'$.local_name'),'')
    ELSE ''
  END
)

UNIQUE(source_id, target_id, type, local_name_gen)
```

Graph reads continued to work because they did not exercise the full compatibility check. `manage_adr(get)` failed for every indexed project with `missing=edges.local_name_gen`.

### ADR recovery assessment

An isolated v0.9.0 probe proved that ADR content is stored in `project_summaries.summary`. Direct read-only inspection of all three production cache databases found one summary row per project with zero-length content. There was no ADR text to recover.

The portable repository artifact `C:\Work\mcp-tests\.codebase-memory\graph.db.zst` was decompressed and inspected read-only. It already used the canonical v0.9.0 schema and contained no ADR summary rows. Only the active native cache required repair.

### Pre-mutation checkpoint

Complete external checkpoint:

```text
C:\Work\mcp\.mcp_backups\cbm_v090_schema_repair_2026-07-26T18-45-01-741Z
```

It contains:

- `manifest.json` with source SHA-256 values and stability checks;
- consistent logical SQLite backups with `integrity_check=ok`;
- raw DB/WAL/SHM copies;
- the repository `.codebase-memory` artifact.

The source databases were byte-stable while the backup was created.

### Repair tool

`scripts/repair_cbm_v090_edges_schema.js` is dry-run by default. Apply mode requires a backup manifest and verifies:

- the source DB hash against the manifest;
- the raw backup hash and presence;
- an empty WAL;
- the exact supported old schema;
- pre-migration integrity and foreign keys.

It rebuilds `edges` transactionally, recreates canonical indexes, and verifies that node, edge, import, project, and ADR-summary data remain unchanged. If a later project or post-check fails, already migrated databases are restored from the raw checkpoint.

### Applied databases

| Project | Nodes | Edges | IMPORTS | ADR length | Result |
|---|---:|---:|---:|---:|---|
| `C-Work-mcp-tests` | 15,366 | 28,248 | 1,121 | 0 | migrated |
| `C-Work-papers-memory-mcp` | 22,360 | 68,711 | 1,975 | 0 | migrated |
| `C-Work-autonomous_llm_handbook` | 21,631 | 23,000 | 3 | 0 | migrated |

For every database:

```text
integrity_check: ok
foreign_key_violations: 0
columns: ... url_path_gen, local_name_gen
```

Post-repair connector validation returned successful `cbm_manage_adr(get)` with empty content for all three projects. `cbm_index_status` remained `ready` with unchanged counts. No reindex was required.

## Test changes

New guards:

- `_tests/smoke_runtime_output_config_fail_fast.js`
- `_tests/smoke_cbm_schema_repair.js`
- `_tests/smoke_oauth21_shared_helpers.js`

Current test inventory:

```text
JavaScript files in _tests: 355
run_all manifest entries:   273
skip-network sections:      public=7, tests_authenticated=265
```

Latest full offline result:

```text
ok=true
version=0.40.0
public=7
tests_authenticated=265
```

## Test-harness state isolation closeout

Final verification exposed a separate test-harness defect: `node server.js --self-test` and standalone smoke child-servers could persist their public or temporary tool surface into the default operational `_control/tool-surface-state.json`. The running OAuth21 server remained at 84 tools, but the control artifact could be overwritten with a test process identity and tool count 13.

The fix has two layers:

- `src/runtime/server_bootstrap_runtime.js` does not start the restart controller or persist tool-surface state in the `--self-test` branch;
- `_tests/helpers/hermetic_server_control_env.js` assigns isolated surface, restart-trigger, and rate-limit state paths to every smoke harness that starts `server.js`, including the full runner.

`_tests/smoke_repo_hygiene_audit.js` now rejects a server-spawning top-level test that lacks hermetic control-state wiring. Nine standalone server harnesses were executed with the operational state hash held constant. The complete offline suite also preserved the same hash.

Polluted-state evidence backup:

```text
C:\Work\mcp\.mcp_backups\tool-surface-state-polluted-by-test-harness-2026-07-27T04-12Z.json
sha256 = 3d58357a7d6f57ef7ba0d522f10044a1213d2caf8913036fb6e2f4f508c900eb
```

The operational artifact was restored to the verified live identity:

```text
tool_count = 84
server_start_id = 2026-07-27T03:10:26.042Z
combined_fingerprint = 6a1329e3b3892b9c
```

A subsequent ordinary `node server.js --self-test` preserved the restored file byte-for-byte (`sha256 = ef27a4c2aaa88d8da8db03a74fb001e1b9a0ec7adf9bffba1aae972081c0edf5`). No additional server restart was required because the defect affected newly launched self-test and smoke child processes, not request handling inside the already running OAuth21 server.

## Live-load closeout

Controlled restart request:

```text
request_id = manual-1785110528926
server_start_id = 2026-07-27T03:10:26.042Z
```

Post-refresh validation confirmed:

- total tool count `84` and `cbm_*` count `15`;
- unchanged `tool_names_hash = 7b5bfc1bd21386d3`;
- unchanged input, output, descriptor, and combined fingerprints, including `combined_fingerprint = 6a1329e3b3892b9c`;
- native CBM `0.9.0` binary SHA-256 `9a205fa5ae759fbc866bfe1554f0c05a303be9ae6e0a00f94d875dc0c25e0680`;
- native calls use stdin transport and no longer emit the raw-JSON deprecation warning;
- `cbm_manage_adr(get)` succeeds for `C-Work-mcp-tests`;
- `cbm_detect_changes(scope="src")` removed `68` duplicate changed-file entries and returned `20` unique scoped paths;
- disposable project `cbm-post-restart-verification-20260727` indexed at `18` nodes and `25` edges, deleted through `state_handle`, and a fresh confirmed repeat returned `cbm_project_not_found`;
- `_tests/fixtures/cbm-live-fixture` remained present;
- no restart or connector refresh remains pending.

Client metadata caveat: the generated function signature visible in this conversation still displayed legacy `confirmation_token` wording, while the repository schema, runtime challenge, and successful confirmed call used `state_handle`. This is a client-presentation cache issue, not a live server contract failure.

## Snippet source-integrity hardening

Follow-up validation on July 29 reproduced a native v0.9.0 integrity defect after an explicit moderate reindex of `C-Work-mcp-tests`: `get_code_snippet` reported `searchIndex` at native lines `898-909`, but the requested declaration was at repository lines `1073-1084`. The native index claimed the current Git revision and `detect_changes` reported no changes, so freshness metadata alone was not sufficient evidence that the source span was correct.

The bridge now validates that a snippet contains the requested symbol. On mismatch it attempts bounded, fail-closed recovery from the verified workspace file:

- the file must remain inside the authorized workspace root after real-path resolution;
- symlinks, non-files, files larger than 4 MiB, and path escapes are rejected;
- declaration candidates are ranked by language-neutral declaration patterns;
- recovered output is capped at 240 lines;
- native and recovered line ranges remain separately visible;
- `source_integrity: bridge_recovered` and `source_reliable: true` identify successful recovery;
- `source_integrity: native_mismatch_unrecovered` and `source_reliable: false` prevent an unverified native span from being treated as exact source.

Hermetic coverage reproduces both successful recovery and an out-of-root fail-closed result. The live bridge stress guard now requires the requested declaration rather than accepting a neighboring symbol from the same file. The project-local `using-codebase-memory` skill instructs agents to inspect these structured fields and verify any unreliable result directly against repository truth.

Controlled restart `manual-1785348037500` loaded the package at `server_start_id = 2026-07-29T18:00:39.162Z`. A direct call through the active `workbench` connector returned:

```text
qualified_name: C-Work-mcp-tests.src.util.workspace_index.searchIndex
native_start_line: 898
native_end_line: 909
start_line: 1073
end_line: 1084
source_integrity: bridge_recovered
source_reliable: true
```

The recovered source contains the requested `async function searchIndex(...)` declaration. The connector-visible surface remains 84 tools with tool-name hash `7b5bfc1bd21386d3`; no connector refresh was required.
