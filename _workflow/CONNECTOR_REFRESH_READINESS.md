# Connector Refresh Readiness

Status: H9 readiness contract plus Stage 6 live evidence. OAuth21 connector refresh was performed externally by the operator and validated via TESTS_MCP.test_mcp_runtime_status; public connector remains disconnected, with public runtime validated locally.

## Blocking rule

Do not refresh the live connector automatically. OAuth21 connector refresh was explicitly performed by the operator for Stage 6; any further ChatGPT connector refresh still requires explicit operator approval.

## Repository truth

- Public connector profile: `public`
- Public connector auth mode: `none`
- Public connector expected tool count: `13`
- Repository truth references: `SERVER_CONNECTOR_SURFACE_SPEC.json`, `SERVER_TOOLS_SPEC.json`

## Public connector allowed tools

```text
search
fetch
net_http_get_allowlisted
net_fetch_text_allowlisted
net_check_url_head
net_fetch_github_raw
net_check_npm_package
net_check_pypi_package
fs_list_public
fs_get_public_info
fs_read_public_text
fs_read_public_lines
fs_read_public_chunk
```

## Public connector forbidden categories

```text
workspace_mutation
process_execution
remote_site_mutation
tool_registry_introspection
```

## Public connector forbidden tool names

```text
write_file
append_file
delete_path
move_path
copy_path
restore_path
run_process
edit_file_patch
write_remote_site_file
edit_remote_site_file
delete_remote_site_file
tool_registry_list
tool_registry_status
```

## OAuth connector separation

The OAuth/resource-server connector must be separate from the public `auth:none` connector. Query-token URLs are not OAuth-ready and must not be used as OAuth connector evidence.

## Operator checklist before live refresh

- [x] Confirm explicit operator approval for OAuth21 live connector refresh.
- [x] Public runtime remains `auth:none`; UI public connector is currently disconnected by operator decision.
- [x] Public runtime `tools/list` exposes exactly 13 allowed public tools locally on 127.0.0.1:3009.
- [x] No forbidden tools appeared in local public runtime tools/list.
- [x] OAuth21/resource-server connector is separate and validated on port 3008.
- [x] Query-token URLs are not used as OAuth-ready URLs; OAuth21 connector uses Authorization Bearer flow.

## Required post-refresh evidence

```text
visible_tool_list
auth_mode
public_base_url_or_resource
tool_count
forbidden_tool_absence
```

H9 acceptance guard: `_tests/smoke_connector_refresh_readiness.js`.
