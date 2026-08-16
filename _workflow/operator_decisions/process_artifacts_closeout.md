# Process Artifacts closeout

Status: repo-validated, not live-loaded
Date: 2026-08-14
Package: `PROCESS-ARTIFACTS`

## Decision

The repository now materializes immutable owner-bound stdout/stderr artifacts from terminal durable process jobs without creating a second execution store.

## Accepted contract

- The existing owner-bound SQLite/WAL process registry remains execution truth.
- Terminal stdout/stderr is materialized into immutable rows in the same SQLite database.
- Artifact identifiers are opaque random values and expose neither owner nor job identity.
- Artifact retention is independent from job retention, so materialized output can survive process-job pruning until its own bounded expiry.
- Metadata is limited to stream, UTF-8 size, SHA-256, creation/expiry timestamps, and bounded W3C trace/span ancestry.
- Raw argv, environment values, OAuth material, baggage, and tracestate are excluded.
- `resources/list` remains empty.
- `resources/read` accepts only explicit `mcp-artifact://process/<opaque-id>` URIs with bounded offset/max_chars, rechecks the authenticated owner, uses private cache scope, and returns `-32002` for missing or cross-owner resources.
- Large terminal Task-backed `run_process` results keep a bounded inline excerpt and add standard MCP `resource_link` blocks. Small results remain inline.
- No new connector-visible tool name or schema was added.

## Regression evidence

The canonical run-all includes `_tests/smoke_process_artifact_store.js`, `_tests/smoke_process_artifact_resources.js`, and `_tests/smoke_process_artifact_task_links.js`.

Final squashed source commit: `8d8a70b029aa3294d72edc20e9d00c27e2fe8527`, based directly on `TRACE-CONTEXT` commit `786ab533ea7345f82e127715381ee46b72eceeca`.

Clean-history validation run `31957637766` passed:

```text
ok=true, version=0.40.0, public=7, tests_authenticated=301
```

The same run passed the source-tree ancestry/equality gate, P0/P1, matrix, generator, resource-policy, event-catalog, repository-hygiene, and pre/post full-suite clean-tree guards.

## Runtime boundary

OAuth21 runtime `3008` was not restarted or reloaded for this package. The live connector remains on the preceding `98`-tool runtime and fingerprint `ec7d3af5b4ea17f5`. Repository artifact behavior is not claimed as live runtime truth yet. No connector refresh or OAuth relogin was performed.

## Next package

`CIMD` is now the highest-leverage internally actionable package, followed by fixture-scoped `MRTR`. CIMD must preserve DCR compatibility while adding explicit SSRF protections for remote client metadata retrieval.
