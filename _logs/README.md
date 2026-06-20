# _logs

## Purpose

Runtime-owned log and local agent-memory output directory for TEST MCP.

This is the active default target for `MCP_TEST_AUDIT_LOG`, `MCP_TEST_LOG_DIR`, and file-backed memory-store output when explicit environment overrides are not supplied.

## Files

- `.mcp-tests-audit.jsonl` — default audit log, generated at runtime.
- `.mcp-agent-state.json` — file-backed agent state, generated at runtime.
- `.mcp-agent-memory.jsonl` — file-backed agent memory entries, generated at runtime.
- `.mcp-agent-tasks.jsonl` — file-backed agent tasks, generated at runtime.
- `README.md` — Directory orientation.

## Subdirectories

- none
