# W3C Trace Context closeout

Status: repo-validated, live-loaded and live-acceptedDate: 2026-08-14
Package: `TRACE-CONTEXT`

## Decision

The repository implements bounded W3C Trace Context correlation for MCP `2026-07-28` request metadata without changing authorization, owner binding, routing, or idempotency semantics.

## Accepted contract

- Bare `_meta.traceparent`, `_meta.tracestate`, and `_meta.baggage` are observability metadata only.
- Missing `traceparent` creates a local trace. Invalid `traceparent` restarts correlation locally and does not fail the MCP business request.
- Invalid `traceparent` discards `tracestate`; invalid `tracestate` does not invalidate a valid trace.
- Raw baggage and raw tracestate are never persisted to the process registry or emitted in audit records.
- Request spans create child execution spans for synchronous and Task-backed `run_process`.
- Durable process jobs persist only `trace_id`, `span_id`, `parent_span_id`, `trace_flags`, and `trace_source`.
- Existing SQLite/WAL registries migrate in place by adding only the missing fixed trace columns.
- Owner isolation remains authoritative for persisted correlation reads. Trace metadata cannot widen access.
- Existing process idempotency semantics remain trace-independent.
- Connector-visible tool names and schemas remain unchanged.

## Regression evidence

The canonical run-all includes `_tests/smoke_w3c_trace_context.js`, `_tests/smoke_w3c_trace_process_correlation.js`, `_tests/smoke_w3c_trace_runtime_integration.js`, and `_tests/smoke_w3c_trace_store_migration.js`. Existing `_tests/smoke_run_process_tool.js` also verifies synchronous child-span audit behavior.

Full repository validation run `31801918351` passed:

```text
ok=true, version=0.40.0, public=7, tests_authenticated=298
```

The same run passed matrix/event-catalog guards and left the repository clean.

## Runtime boundary

Controlled live load completed on 2026-08-16 at `server_start_id = 2026-08-16T19:04:37.288Z` from final source `737cdc8b97ec1e966823dc2566eb7d5cd221e9b6`; connector fingerprint is `ec7d3af5b4ea17f5` with the same `98` tool names.

A live modern `run_process` call resolved request trace `8dd7ec7f9bddeb360c3933f1e77a2b6c` with request span `b30d7ed041609eb6`, then emitted execution child span `bdff6e5f06b04cce` with `parent_span_id = b30d7ed041609eb6`. A separate Task-backed live execution persisted trace `8dd0f95cfb76cfa719af99c69bc8e2ae`, child span `1f4deb3e376e86f7`, parent `addcaee3ad7e0838`, flags `00`, and source `internal_child` through queued, running, completed, output-read, and artifact records. This is direct runtime evidence for the accepted request → execution → Task/artifact correlation spine.## Next package

`PROCESS-ARTIFACTS` is now the highest-leverage internally actionable package. It must add owner-bound immutable process output artifacts with opaque links, hashes, retention, and bounded reads on top of the accepted correlation spine.
