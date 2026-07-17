# DIRECTORY

Status: active src directory map
Updated: 2026-07-17

- `auth/`
  OAuth/OAuth21, legacy auth, and authorization-server implementation modules.
- `exec/`
  Bounded execution and process-control support.
- `memory/`
  Memory/state/task support modules for the MCP surface.
- `plugin/`
  Plugin registry, visibility, governance, and execution support.
- `runtime/`
  Core MCP runtime assembly, routing, handlers, and observability wiring.
- `schemas/`
  Schema and descriptor helpers for MCP-visible contracts.
- `truth/`
  Read-only truth/audit helpers used for repo/runtime/workflow inspection.
- `util/`
  General utility support used across runtime and guards.
- `client_entry_blocker_matrix.js`
  Shared blocker-matrix helper for current-window diagnostics plus retained-evidence freshness-window comparisons; used by both live `observability_status` and workflow evidence scripts.
- `README.md`
  Source-tree orientation note.
