# DIRECTORY

Status: active logs directory map
Updated: 2026-07-17

- `compact/`
  Compact derived log/report artifacts kept outside committed source truth.
- `.mcp-tests-audit.jsonl`
  Default structured runtime audit log for TEST MCP request, response, and lifecycle evidence.
- `.mcp-agent-state.json`
  File-backed local agent state output when explicit overrides are not supplied.
- `.mcp-agent-memory.jsonl`
  File-backed local agent memory output when explicit overrides are not supplied.
- `.mcp-agent-tasks.jsonl`
  File-backed local agent task output when explicit overrides are not supplied.
- `README.md`
  Human-oriented `_logs` usage and purpose note.

This directory is runtime-owned and high-churn. Treat the generated files as operational evidence, not canonical product/workflow truth.
