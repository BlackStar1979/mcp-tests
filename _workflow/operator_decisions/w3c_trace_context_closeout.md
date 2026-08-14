# W3C Trace Context closeout

Status: repo-validated, not live-loaded
Date: 2026-08-14
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

OAuth21 runtime `3008` was not restarted or reloaded for this package. The live connector remains on the preceding `98`-tool runtime and fingerprint `ec7d3af5b4ea17f5`. Repository trace behavior is not claimed as live runtime truth yet. No connector refresh or OAuth relogin was performed.

## Next package

`PROCESS-ARTIFACTS` is now the highest-leverage internally actionable package. It must add owner-bound immutable process output artifacts with opaque links, hashes, retention, and bounded reads on top of the accepted correlation spine.
