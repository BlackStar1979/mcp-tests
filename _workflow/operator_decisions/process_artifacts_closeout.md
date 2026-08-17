# Process Artifacts closeout

Status: repo-validated, live-loaded and live-accepted
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

Controlled live load completed on 2026-08-16 at `server_start_id = 2026-08-16T19:04:37.288Z`, fingerprint `ec7d3af5b4ea17f5`, with the connector-visible surface unchanged at `98` tools.

A live durable process job materialized immutable stdout/stderr rows in `tests_process_jobs_3008.sqlite` with opaque artifact IDs and SHA-256 digests. The Task-backed live job `b29ed763-93db-4427-9675-f7476656ce05` materialized both streams with the persisted execution correlation (`trace_id = 8dd0f95cfb76cfa719af99c69bc8e2ae`, `span_id = 1f4deb3e376e86f7`, `parent_span_id = addcaee3ad7e0838`). A subsequent authenticated MCP `resources/read` for its opaque stdout URI returned one `text/plain; charset=utf-8` resource containing the expected `LIVE_TASK_OK` output and the exact requested URI. This directly proves live materialization plus bounded private resource retrieval.

## Next package

`CIMD` is now the highest-leverage internally actionable package, followed by fixture-scoped `MRTR`. CIMD must preserve DCR compatibility while adding explicit SSRF protections for remote client metadata retrieval.
