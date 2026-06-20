# tools

## Purpose

Connector tool facade layer. Canonical active MCP loading goes through tools/public and tools/authorized. tools/internal is reserved for hidden server-internal helpers; flat tools/*.js are legacy implementation targets until fully migrated.

## Files

- `auth_bearer_cutover_guard.js` — JavaScript module or executable smoke/helper script in this area.
- `auth_bearer_dry_run.js` — JavaScript module or executable smoke/helper script in this area.
- `auth_modular_parity_status.js` — JavaScript module or executable smoke/helper script in this area.
- `auth_transition_status.js` — JavaScript module or executable smoke/helper script in this area.
- `code_sample_js.js` — JavaScript module or executable smoke/helper script in this area.
- `dev_code_audit.js` — JavaScript module or executable smoke/helper script in this area.
- `dev_code_dependencies.js` — JavaScript module or executable smoke/helper script in this area.
- `dev_code_impact.js` — JavaScript module or executable smoke/helper script in this area.
- `dev_code_locate.js` — JavaScript module or executable smoke/helper script in this area.
- `dev_code_symbols.js` — JavaScript module or executable smoke/helper script in this area.
- `dev_code_syntax_check.js` — JavaScript module or executable smoke/helper script in this area.
- `fs_get_public_info.js` — JavaScript module or executable smoke/helper script in this area.
- `fs_list_public.js` — JavaScript module or executable smoke/helper script in this area.
- `fs_read_public_chunk.js` — JavaScript module or executable smoke/helper script in this area.
- `fs_read_public_lines.js` — JavaScript module or executable smoke/helper script in this area.
- `fs_read_public_text.js` — JavaScript module or executable smoke/helper script in this area.
- `net_check_npm_package.js` — JavaScript module or executable smoke/helper script in this area.
- `net_check_pypi_package.js` — JavaScript module or executable smoke/helper script in this area.
- `net_check_url_head.js` — JavaScript module or executable smoke/helper script in this area.
- `net_fetch_github_raw.js` — JavaScript module or executable smoke/helper script in this area.
- `net_fetch_text_allowlisted.js` — JavaScript module or executable smoke/helper script in this area.
- `net_http_get_allowlisted.js` — JavaScript module or executable smoke/helper script in this area.
- `observability_status.js` — JavaScript module or executable smoke/helper script in this area.
- `plugin_catalog_describe.js` — JavaScript module or executable smoke/helper script in this area.
- `plugin_catalog_search.js` — JavaScript module or executable smoke/helper script in this area.
- `plugin_execute_readonly.js` — JavaScript module or executable smoke/helper script in this area.
- `plugin_execution_governance.js` — JavaScript module or executable smoke/helper script in this area.
- `plugin_execution_preflight.js` — JavaScript module or executable smoke/helper script in this area.
- `plugin_execution_verify_receipt.js` — JavaScript module or executable smoke/helper script in this area.
- `plugin_registry_audit.js` — JavaScript module or executable smoke/helper script in this area.
- `plugin_registry_get.js` — JavaScript module or executable smoke/helper script in this area.
- `plugin_registry_list.js` — JavaScript module or executable smoke/helper script in this area.
- `plugin_registry_status.js` — JavaScript module or executable smoke/helper script in this area.
- `plugin_visibility_plan.js` — JavaScript module or executable smoke/helper script in this area.
- `plugin_visibility_status.js` — JavaScript module or executable smoke/helper script in this area.
- `README.md` — Directory orientation maintained by the semantic README writer.
- `session_toolset_plan.js` — JavaScript module or executable smoke/helper script in this area.
- `session_toolset_status.js` — JavaScript module or executable smoke/helper script in this area.
- `test_mcp_runtime_status.js` — JavaScript module or executable smoke/helper script in this area.

## Subdirectories

- `public/` — Public MCP-exposed facades.
- `authorized/` — Authenticated MCP-exposed facades.
- `internal/` — Hidden technical facades not exposed through MCP schema.
- `internal` — Internal governance/status tool facades.
- `public` — Public-safe tool facades exposed to connector public profile.
