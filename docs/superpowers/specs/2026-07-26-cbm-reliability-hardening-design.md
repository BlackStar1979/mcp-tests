# CBM Reliability Hardening Design

Date: 2026-07-26
Status: operator-approved through standing authorization for all discovered repairs

## Goal

Harden the `mcp-tests` Codebase-Memory integration and startup path against failures discovered by live `cbm_*` analysis: Windows command-line payload limits, duplicate change results, late runtime configuration validation, operator-specific executable fallback, and unsafe reindexing when ADR preservation cannot be verified.

The package keeps the connector-visible surface unchanged at 84 tools, including 15 `cbm_*` tools. It does not restart the server, refresh the connector, commit, push, delete an index, or reindex an existing project until ADR preservation is demonstrably safe.

## Confirmed root causes

1. `runCbmProcess()` serializes the complete native payload into one argv element. On the current Windows host, approximately 64,000 characters already fail with `ENAMETOOLONG`, while public schemas allow 100,000-character ADR bodies and trace batches much larger than that.
2. Native v0.9.0 explicitly supports JSON on stdin. `cli --json <tool>` with piped JSON returns the same MCP envelope without the raw-JSON deprecation warning.
3. `boundConnectorResult()` filters and truncates `detect_changes` arrays but never deduplicates them. Native output can contain the same tracked path twice, inflating counts and consuming the 200-item connector budget.
4. `runServerBootstrapRuntime()` validates `MCP_TEST_OUTPUT_MODE` and `MCP_TEST_FETCH_CAP_CHARS` after descriptor construction, restart-controller startup, and tool-surface persistence. Invalid output mode is therefore misreported as schema incompatibility and can create filesystem state before rejection.
5. `defaultExecutablePath()` falls back to a literal `C:\Users\mczyz\...` path when standard Windows profile variables are absent.
6. `cbm_index_repository` continues reindexing when an existing project's ADR snapshot fails. The live index currently demonstrates this condition: project status is ready and `adr_present=true`, while `manage_adr(get)` fails with an incompatible-store diagnostic.

## Design

### Native invocation transport

All native tool payloads are written as UTF-8 JSON to child stdin. argv contains only the stable executable prefix and `cli --json <tool>`. Child stdin is always piped, ended exactly once, and any synchronous stdin write failure is classified as a spawn failure. The payload is not written to diagnostics or audit output.

This removes the Windows argv limit, removes the upstream deprecation warning, and preserves existing stdout normalization. Probe commands remain unchanged because they have no JSON payload.

### Change-result normalization

Normalize paths with forward slashes and deduplicate case-insensitively on Windows before applying scope filtering, totals, truncation, and result emission. Preserve native totals separately whenever normalization changes cardinality. Deduplicate impacted symbols by a stable composite of qualified name, file path, label, and depth. Add a bounded warning when duplicates were removed.

Connector totals describe normalized unique results. Native totals describe upstream array lengths.

### Fail-fast startup configuration

Extract a pure `resolveRuntimeOutputConfig(env)` helper. It normalizes and validates output mode and fetch cap before profile mutation, OAuth storage construction, logger creation, restart-controller startup, or state persistence. Invalid values throw a typed error carrying `exitCode=2` and the existing operator-facing message.

`server.js` preserves typed exit codes. Library code no longer calls `process.exit()`.

### Executable resolution

Resolution order remains explicit option, `CBM_EXE_PATH`, Windows `LOCALAPPDATA`, Windows `USERPROFILE`, then executable name `codebase-memory-mcp.exe` for PATH resolution. No literal operator profile path remains in production code.

### ADR-preserving reindex gate

When an existing project matches the requested repository, successful ADR retrieval is a precondition for reindexing. Failure or malformed ADR output returns `cbm_adr_snapshot_unavailable` before invoking native `index_repository`. An empty ADR string is a valid snapshot. Metadata distinguishes snapshot availability from non-empty content.

This gate intentionally prevents automatic repair of the currently incompatible live index. State repair requires a separate, backed-up migration after the bridge proves that ADR can be preserved or the operator explicitly accepts loss.

## Testing

1. Extend the fake native CBM fixture to read stdin and echo parsed payload metadata.
2. Prove a payload larger than 100,000 characters reaches the fixture without appearing in argv.
3. Prove stdin invocation contains no raw JSON argv element.
4. Add duplicate `detect_changes` fixtures for paths and symbols, with and without scope.
5. Add bootstrap subprocess tests proving both invalid output settings exit 2 with the intended message and create no configured audit, state, restart, or rate-limit artifacts.
6. Add executable-resolution tests with empty Windows profile variables.
7. Add index-tool tests proving ADR snapshot failure blocks native indexing and empty ADR remains valid.
8. Run targeted smokes, full offline suite, syntax checks, JSON parsing, server self-test, and `git diff --check`.

## Documentation and workflow impact

Update CBM compatibility documentation, runtime configuration documentation, active workflow orientation, test counts, and generated directory maps only where mechanically required. No connector schema or tool count changes are expected.

## Non-goals

- No live server restart or connector refresh.
- No commit or push without separate authorization.
- No destructive index operation.
- No reindex of `C-Work-mcp-tests` while ADR snapshot retrieval is incompatible.
- No broad OAuth refactor in this package; exact duplicate helpers are recorded for a subsequent independently testable refactor after reliability guards are green.
