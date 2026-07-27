# Codebase-Memory CLI Bridge Design

Date: 2026-07-26
Status: approved for implementation

## Goal

Expose a bounded first-party subset of `codebase-memory-mcp.exe` functionality through the authenticated `mcp-tests` connector without creating a second public MCP endpoint or a persistent child MCP session.

## Architecture

`mcp-tests` remains the only remote MCP server. Authorized `cbm_*` tools call a private Node.js adapter. The adapter executes the local binary in one-shot mode:

```text
codebase-memory-mcp.exe cli --json <tool-name> <json-arguments>
```

Each call uses `spawn` with `shell: false`, bounded output, an operation-specific timeout, a sanitized environment, and a fixed executable path resolved only from server configuration.

The bridge does not expose generic process execution and does not permit callers to choose an executable or arbitrary CBM tool name.

## Initial tool surface

The MVP exposes five authenticated tools:

- `cbm_status` — reports profile-managed exposure state, dependency availability, resolved executable path, detected version, timeout policy, indexing lock state, and watcher posture.
- `cbm_list_projects` — lists existing CBM indexes.
- `cbm_index_repository` — resolves a repository beneath an authorized workspace root and calls `index_repository` explicitly.
- `cbm_get_architecture` — returns architecture data for an indexed project.
- `cbm_search_graph` — performs bounded graph search for an indexed project.

The remaining CBM tools are deferred until this path is validated through the live ChatGPT connector.

## Profile-controlled exposure and dependency availability

Tool exposure is controlled exclusively by the server profile. The authenticated surface of profile `tests` exposes all five `cbm_*` tools; the public surface exposes none of them. No CBM-specific feature flag may add, remove, or conditionally hide these tools.

The executable probe determines only whether calls can currently be fulfilled:

1. The resolved executable exists as a regular file.
2. Running `<exe> --version` succeeds within 5 seconds.
3. The output matches `codebase-memory-mcp <semantic-version>`.

A failed probe must not prevent `mcp-tests` from starting and must not change `tools/list`. All five tools remain registered on `tests.authenticated`; operational calls return a structured `cbm_unavailable` result, while `cbm_status` exposes the cached diagnostic state. The executable path uses the platform-aware server default unless an optional machine-level `CBM_EXE_PATH` override is configured; callers cannot override it.

## Watcher decision

The one-shot CLI bridge does not maintain a persistent CBM MCP session, so no session-owned watcher is started by this integration.

This does not affect correctness against the current stored index. It affects freshness only: repository changes made after the most recent successful indexing operation may not appear in search results.

The MVP addresses this explicitly:

- `cbm_index_repository` is the only indexing operation.
- Read tools do not silently trigger indexing.
- Read-tool descriptions state that results reflect the latest successful CBM index.
- `cbm_status` reports `watcher_mode: "not_managed_by_bridge"`.
- A later persistent-stdio package may add continuous watching if live use shows that explicit synchronization is insufficient.

## Path policy

Callers provide a logical workspace path for synchronization. The bridge resolves it through the existing `safeWorkspacePath` boundary. Only directories beneath configured workspace roots are accepted. The absolute path is passed to CBM only after boundary validation.

Read tools use an indexed project name, not an arbitrary filesystem path.

## Timeout policy

Timeouts are operation-specific and server-controlled:

- availability probe: 5 seconds;
- list/status: 30 seconds;
- architecture/search: 60 seconds;
- repository indexing: 10 minutes by default;
- hard indexing ceiling: 30 minutes.

The caller cannot exceed server limits. A timeout terminates the child process and returns a structured `timeout` result. A timed-out synchronization is not reported as successful; the previous completed index remains the only trusted state.

Large repositories are handled by the longer synchronization budget. Indexing is never hidden inside a normal read call, preventing connector request timeouts from unexpectedly turning a search into a long-running mutation.

## Concurrency

- At most one `cbm_index_repository` operation runs at a time in the `mcp-tests` process.
- Read calls do not acquire the indexing lock and never trigger indexing.
- The first implementation uses a process-local lock; cross-process coordination remains CBM's responsibility.

## Output handling

The adapter parses stdout as JSON. Non-JSON output, non-zero exit codes, spawn failures, and truncation produce structured errors.

Audit records include tool name, project or logical path, duration, exit status, timeout state, and output size. They must not include returned source snippets or full graph payloads.

## Security classification

All `cbm_*` tools are authenticated tools and are absent from the public profile.

- `cbm_status`, `cbm_list_projects`, `cbm_get_architecture`, and `cbm_search_graph` are read operations.
- `cbm_index_repository` is a workspace-index mutation and requires audit.

## Testing

The implementation must include hermetic tests using a fake executable, not the operator's real CBM installation. Tests cover:

- missing executable;
- invalid version output;
- successful version probe and cached availability;
- stable exposure of all five tools on `tests.authenticated` when the executable is unavailable;
- path escape rejection;
- correct CLI arguments and JSON parsing;
- read timeout;
- synchronization timeout;
- output truncation/error classification;
- public-profile exclusion;
- authenticated-profile inclusion independent of probe success;
- no implicit indexing from read tools.

Live validation against the real executable and connector is a separate post-merge/operator step.

## Rollout

1. Implement and pass hermetic tests.
2. Confirm that profile `tests` exposes all five `cbm_*` tools in repository-level surface assembly without any CBM-specific feature flag.
3. Request the controlled restart only with `node .\scripts\request-restart.js --code=42 --reason=manual` from `C:\Work\mcp-tests`. Do not start a replacement server or supervisor process.
4. Report the requested surface change to the operator. The operator refreshes the ChatGPT connector.
5. After the operator confirms the connector refresh, verify live `tools/list` and invoke `cbm_status`.
6. Run `cbm_index_repository` only after separate explicit operator authorization, then validate architecture/search calls.
