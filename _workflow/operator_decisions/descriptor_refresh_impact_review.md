# Descriptor Refresh Impact Review

Status: GREEN / CURRENT CODEX CLIENT FETCHED CURRENT DESCRIPTORS / NO MANUAL CONNECTOR REFRESH REQUIRED
Date: 2026-08-01

## Scope

Close the descriptor-only review created when the memory embedding package changed `memory_search` and `memory_save` to `openWorldHint: true` without changing tool names or input/output schema shapes. The package also changed descriptive schema metadata, which is intentionally covered by the descriptor fingerprint.

## Current protocol interpretation

- MCP tool annotations are hints supplied to clients, not authorization controls.
- `openWorldHint: true` is correct for memory operations that may call the explicitly configured external embedding provider.
- The server fingerprint includes title, description, schemas, and annotations, so the descriptor change is represented by the current descriptor and combined fingerprints.

## Live evidence

- Runtime: `server_start_id = 2026-08-01T17:51:19.986Z`.
- Surface: `84` tools.
- Tool names hash: `7b5bfc1bd21386d3`.
- Input schema fingerprint: `f835e87d9899b3fa`.
- Output schema fingerprint: `fdb0ceeae9e3c68d`.
- Descriptor fingerprint: `26f35b84a92470b8`.
- Combined fingerprint: `673f28e12afea85c`.
- `codex-mcp-client 0.146.0-alpha.9.2` initialized and received `tools_list_served` with the current fingerprint at `2026-08-01T17:51:57.955Z` and again at `2026-08-01T17:52:13.503Z`.
- Both responses carried `ttl_ms = 0` and `cache_scope = private`.
- The current model tool surface contains the hybrid memory-search description and the current memory-save contract.
- A direct own-connector `memory_search` call succeeded after the current descriptor fetch.

## Decision

The descriptor refresh requirement is satisfied by the client's observed `tools/list` fetch. No connector removal, re-add, OAuth relogin, runtime restart, tool rename, or schema-shape change is required.

Current state:

- `connector_map_status = live_84_descriptor_current`
- `connector_refresh_required_now = false`
- connector-visible tool count remains `84`
- tool names and input/output schema shapes remain unchanged

## Protocol references

- [MCP 2025-11-25 schema: ToolAnnotations](https://modelcontextprotocol.io/specification/2025-11-25/schema#toolannotations)
- [MCP project guidance on tool annotations](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/)

## Reopen conditions

Reopen only if a client uses tools after initialize without an observed current-window `tools/list`, the served fingerprint differs from the runtime fingerprint, or the model-visible memory tool contract no longer matches the current repository descriptor.
