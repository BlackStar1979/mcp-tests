# Modular Tool Migration Inventory

Generated: 2026-07-04T12:58:53.479Z

## Summary

- Source repo: `C:/Work/mcp`
- Target repo: `C:/Work/mcp-tests`
- Total modular external tools: 63
- Existing exact/equivalent overlap: 21
- Missing in mcp-tests: 42

### By target surface

- `public`: 7
- `tests`: 56

### By safety

- `safe`: 45
- `unsafe`: 18

### By migration action

- `already_present`: 10
- `do_not_port_alias`: 1
- `keep_existing`: 8
- `port_tests`: 42
- `rename_on_port`: 2

## Review-first items

- none

## Overlap resolutions

- `change_workflow_simulator` -> `change_workflow_simulator` : `already_present`
- `check_npm_package` -> `net_check_npm_package` : `merged_into_existing_keep_existing`
- `check_pypi_package` -> `net_check_pypi_package` : `merged_into_existing_keep_existing`
- `code_audit` -> `dev_code_audit` : `prefer_existing`
- `code_dependencies` -> `dev_code_dependencies` : `prefer_existing`
- `code_impact` -> `dev_code_impact` : `prefer_existing`
- `code_runtime_map` -> `code_runtime_map` : `already_present`
- `code_symbols` -> `dev_code_symbols` : `prefer_existing`
- `deploy_decision_guard` -> `deploy_decision_guard` : `already_present`
- `fetch` -> `fetch` : `keep_existing_and_port_renamed`
- `fetch_github_file` -> `net_fetch_github_raw` : `prefer_existing`
- `get_info` -> `get_info` : `already_present`
- `http_get` -> `net_http_get_allowlisted` : `prefer_existing`
- `list_directory` -> `list_directory` : `already_present`
- `project_truth_audit` -> `project_truth_audit` : `already_present`
- `pypi_info` -> `net_check_pypi_package` : `merge_unique_fields`
- `read_file` -> `read_file` : `already_present`
- `read_file_chunk` -> `read_file_chunk` : `already_present`
- `read_file_lines` -> `read_file_lines` : `already_present`
- `search` -> `search` : `keep_existing_and_port_renamed`
- `tool_usage_snapshot` -> `tool_usage_snapshot` : `already_present`

## Inventory

| tool | family | safety | target surface | overlap | resolution | action |
| --- | --- | --- | --- | --- | --- | --- |
| `append_file` | `filesystem_mutation` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `build_index` | `index` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `change_workflow_simulator` | `truth` | `safe` | `tests` | `exact_tests:change_workflow_simulator` | `-` | `already_present` |
| `check_npm_package` | `web` | `safe` | `public` | `capability_overlap:net_check_npm_package` | `merged_into_existing_keep_existing` | `keep_existing` |
| `check_pypi_package` | `web` | `safe` | `public` | `capability_overlap:net_check_pypi_package` | `merged_into_existing_keep_existing` | `keep_existing` |
| `code_apply_patch` | `code` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `code_audit` | `code` | `safe` | `tests` | `capability_overlap:dev_code_audit` | `prefer_existing` | `keep_existing` |
| `code_dependencies` | `code` | `safe` | `tests` | `capability_overlap:dev_code_dependencies` | `prefer_existing` | `keep_existing` |
| `code_impact` | `code` | `safe` | `tests` | `capability_overlap:dev_code_impact` | `prefer_existing` | `keep_existing` |
| `code_orchestrate` | `code` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `code_patch_plan` | `code` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `code_rollback_patch` | `code` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `code_runtime_map` | `truth` | `safe` | `tests` | `exact_tests:code_runtime_map` | `-` | `already_present` |
| `code_scenario` | `code` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `code_symbols` | `code` | `safe` | `tests` | `capability_overlap:dev_code_symbols` | `prefer_existing` | `keep_existing` |
| `collect_context` | `index` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `collect_romionsim_context` | `index` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `copy_path` | `filesystem_mutation` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `delete_path` | `filesystem_mutation` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `delete_remote_site_file` | `remote_site_file_ops` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `deploy_decision_guard` | `truth` | `safe` | `tests` | `exact_tests:deploy_decision_guard` | `-` | `already_present` |
| `edit_file_patch` | `filesystem_patch` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `edit_remote_site_file` | `remote_site_file_ops` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `fetch` | `connector` | `safe` | `public` | `name_conflict_semantic_divergence:fetch` | `keep_existing_and_port_renamed` | `rename_on_port` |
| `fetch_github_file` | `web` | `safe` | `public` | `capability_overlap:net_fetch_github_raw` | `prefer_existing` | `keep_existing` |
| `fits_info` | `science` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `get_info` | `filesystem_read` | `safe` | `tests` | `exact_tests:get_info` | `-` | `already_present` |
| `hdf5_info` | `science` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `http_get` | `web` | `safe` | `public` | `capability_overlap:net_http_get_allowlisted` | `prefer_existing` | `keep_existing` |
| `index_status` | `index` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `inventory_tree` | `science` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `list_directory` | `filesystem_read` | `safe` | `tests` | `exact_tests:list_directory` | `-` | `already_present` |
| `list_remote_site_files` | `remote_site_file_ops` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `move_path` | `filesystem_mutation` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `move_remote_site_file` | `remote_site_file_ops` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `preview_remote_site_retention` | `remote_site_runtime` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `process_runner_status` | `process` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `project_truth_audit` | `truth` | `safe` | `tests` | `exact_tests:project_truth_audit` | `-` | `already_present` |
| `pypi_info` | `web` | `safe` | `public` | `capability_overlap:net_check_pypi_package` | `merge_unique_fields` | `do_not_port_alias` |
| `read_file` | `filesystem_read` | `safe` | `tests` | `exact_tests:read_file` | `-` | `already_present` |
| `read_file_chunk` | `filesystem_read` | `safe` | `tests` | `exact_tests:read_file_chunk` | `-` | `already_present` |
| `read_file_lines` | `filesystem_read` | `safe` | `tests` | `exact_tests:read_file_lines` | `-` | `already_present` |
| `read_remote_site_file` | `remote_site_file_ops` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `remote_site_runtime_status` | `remote_site_runtime` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `restore_path` | `filesystem_mutation` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `restore_remote_site_file` | `remote_site_file_ops` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `run_process` | `process` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `search` | `connector` | `safe` | `public` | `name_conflict_semantic_divergence:search` | `keep_existing_and_port_renamed` | `rename_on_port` |
| `search_index` | `index` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `search_index_context` | `index` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `table_profile` | `science` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `tool_dispatch` | `code` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `tool_registry_execute` | `registry` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `tool_registry_get_tool` | `registry` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `tool_registry_list` | `registry` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `tool_registry_plan` | `registry` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `tool_registry_policy` | `registry` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `tool_registry_preflight` | `registry` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `tool_registry_status` | `code` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `tool_registry_validate_tool` | `registry` | `safe` | `tests` | `missing` | `-` | `port_tests` |
| `tool_usage_snapshot` | `truth` | `safe` | `tests` | `exact_tests:tool_usage_snapshot` | `-` | `already_present` |
| `write_file` | `filesystem_mutation` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |
| `write_remote_site_file` | `remote_site_file_ops` | `unsafe` | `tests` | `missing` | `-` | `port_tests` |

