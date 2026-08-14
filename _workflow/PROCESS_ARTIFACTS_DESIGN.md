# PROCESS-ARTIFACTS design

Status: active P2 implementation design
Updated: 2026-08-14

## Objective

Materialize immutable owner-bound stdout/stderr artifacts for durable process jobs without introducing a second execution store or expanding `resources/list`.

## Invariants

- The existing owner-bound SQLite/WAL process registry remains execution truth.
- Terminal stdout/stderr snapshots are copied into immutable artifact rows in the same SQLite database.
- Artifact identifiers are random opaque values and reveal neither owner nor job identity.
- Artifact rows survive process-job pruning until their independent bounded artifact retention expires.
- Artifact access always rechecks the authenticated process owner; cross-owner access is indistinguishable from missing artifacts.
- Artifact metadata includes stream, UTF-8 size, SHA-256, creation/expiry timestamps, and bounded W3C correlation identifiers.
- No argv, environment values, OAuth material, baggage, or tracestate enters artifact metadata.
- `resources/list` remains empty. Tool-returned `resource_link` values do not become globally enumerable resources.
- `resources/read` reads one bounded immutable chunk identified by an explicit artifact URI. It is not a cursor protocol.
- Large Task-backed `run_process` results return bounded inline excerpts plus standard MCP `resource_link` content blocks.
- Small process results keep the existing inline behavior.
- No new connector-visible tool name is required for P2.

## URI model

Base artifact URI:

`mcp-artifact://process/<opaque-id>`

Explicit bounded chunk URI:

`mcp-artifact://process/<opaque-id>?offset=<n>&max_chars=<bounded-n>`

The server returns the next explicit chunk URI in result `_meta` when more content exists.

## Retention

Artifact retention is independent from process-job retention and globally bounded by time and count. Default artifact retention is longer than the current process-job retention so a materialized artifact can remain readable after its source job is pruned.
