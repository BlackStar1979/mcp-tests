# Codebase-Memory v0.9.0 Compatibility Hardening Design

Date: 2026-07-26
Status: approved by the operator

## Goal

Rebaseline the `mcp-tests` CBM bridge against the locally installed `codebase-memory-mcp 0.9.0`, make compatibility observable and self-invalidating when the executable changes, enforce native path containment, correct destructive-operation governance, and rerun live quality tests on indexes produced entirely by v0.9.0.

The connector surface remains 15 `cbm_*` tools: 14 native CBM operations plus bridge-only `cbm_status`. This package does not add tools from upstream `main` that are absent from the local v0.9.0 binary.

## Sources of truth

Compatibility authority is ordered as follows:

1. local executable identity and `--version` output;
2. local `cli <tool> --help` output;
3. repository contract manifest for the exact executable version;
4. upstream documentation at tag `v0.9.0`;
5. upstream `main` only as future-version context.

The local executable is currently version `0.9.0`, size `273333760` bytes, SHA-256 `9a205fa5ae759fbc866bfe1554f0c05a303be9ae6e0a00f94d875dc0c25e0680`, at `C:\Users\mczyz\AppData\Local\Programs\codebase-memory-mcp\codebase-memory-mcp.exe`.

The binary exposes exactly 14 native tools: `index_repository`, `search_graph`, `query_graph`, `trace_path`, `get_code_snippet`, `get_graph_schema`, `get_architecture`, `search_code`, `list_projects`, `delete_project`, `index_status`, `detect_changes`, `manage_adr`, and `ingest_traces`.

## Versioned contract manifest

Add a checked-in manifest generated from local CLI help. It records exact version, executable hash used for capture, ordered native tool names, required and optional flags, value classes, help hashes, and tagged-document references.

Runtime code does not regenerate the manifest. A bounded developer script performs explicit capture and comparison. Runtime loads the manifest and reports one state: `compatible`, `compatible_binary_variant`, `unknown_newer_version`, `unsupported_older_version`, `contract_mismatch`, `binary_changed_since_probe`, or `probe_failed`.

## Probe cache invalidation

Replace process-lifetime availability caching with executable-identity caching. Identity contains normalized path, size, high-resolution modification time, and SHA-256 calculated during probe. Fast checks compare path, size, and mtime; any change invalidates cached version and hash before tool execution.

`cbm_status` reports executable identity, installed and manifest versions, compatibility state, native tool count and names, containment root, queue state, mutation state, and timeout policy.

# Native containment

Every CBM child receives `CBM_ALLOWED_ROOT` derived from the workspace root that authorized the repository. Wrapper validation remains authoritative for logical paths and rejects absolute paths, traversal, symlinks, non-directories, and realpath escapes. Native containment is defense in depth.

Production callers cannot provide arbitrary child environment values. Tests may inject a narrower root through dependency-injection options.

## Contract-aligned schemas

Schemas remain bounded versions of local v0.9.0 flags. Confirmed fields include `get_architecture.path`, `detect_changes.since`, `trace_path.parameter_name`, `edge_types`, `risk_labels`, `include_tests`, `query_graph.max_rows`, and `manage_adr.mode|content|sections`.

The previous ineffective `get_architecture.path` result is a quality regression candidate, not evidence that the field is unsupported. No tool absent from local v0.9.0 help is added.

## Execution telemetry and concurrency

Each native envelope adds `queue_wait_ms`, `execution_ms`, `binary_version`, `compatibility_status`, `partial_success`, and `warnings`.

Retain the exclusive mutation lock. Add a heavy-read semaphore with capacity two for architecture, graph search/query, path tracing, snippets, code search, and change detection. Simple reads remain concurrent. Queue waiting counts against the total timeout budget and is reported separately.

## Error classification

Normalize failures into stable bridge codes: `cbm_binary_unavailable`, `cbm_version_incompatible`, `cbm_contract_mismatch`, `cbm_project_not_found`, `cbm_native_rejected`, `cbm_timeout`, `cbm_output_limit`, `cbm_policy_denied`, `cbm_partial_success`, and `cbm_invalid_output`.

A successful native payload containing `skipped[]` or explicit warnings remains successful with `partial_success: true` and bounded warning summaries.

## Destructive operation governance

The current runtime denies every destructive tool before execution. Replace the dead surface with a two-phase challenge on the existing `cbm_delete_project` tool, without changing the 15-tool count:

1. first authenticated call with `project` only returns `cbm_confirmation_required`, a bounded project summary, and a short-lived one-time state handle;
2. second call supplies the same `project`, `confirm: true`, and `state_handle`;
3. policy validates handle TTL, project binding, authenticated-subject binding, and one-time use;
4. native `delete_project` executes.

The challenge authorizes only deletion of the named CBM index, never source files.

## Fresh-index isolation

Live v0.9.0 testing uses a dedicated cache root. All three repositories are indexed from empty storage so v0.8.1 graph artifacts cannot influence parser and resolver results. The default cache is not deleted or overwritten.

# Per-tool rebaseline focus

Retest full and incremental indexing, architecture path scoping, same-name graph search, Cypher aggregation and mutation rejection, trace disambiguation and recursion, snippet encodings and recursion metadata, search latency and concurrency, change detection with scope/since/staged/unstaged/rename/no-change, ADR mode semantics and preservation, trace validation and graph delta, and two-phase fixture-index deletion.

## Rollout

1. Capture the v0.9.0 contract and add failing compatibility tests.
2. Implement identity-aware probing, manifest verification, containment, telemetry, and stable errors.
3. Implement two-phase destructive confirmation and tests.
4. Update schemas, canonical specs, workflow truth, and operator documentation.
5. Run targeted tests, the full offline suite, syntax checks, JSON parsing, server self-test, and `git diff --check`.
6. Request restart only with `node .\scripts\request-restart.js --code=42 --reason=manual`.
7. After operator connector refresh confirmation, verify runtime version 0.9.0.
8. Run the isolated fresh-cache v0.9.0 matrix and record remaining upstream versus bridge defects.

## Non-goals

- No automatic executable update.
- No indexing outside authorized workspace roots.
- No deletion of source repositories.
- No adoption of upstream `main` tools absent from v0.9.0.
- No silent migration or deletion of the existing default cache.
- No claim that a v0.8.1-produced graph validates v0.9.0 parser fixes.
