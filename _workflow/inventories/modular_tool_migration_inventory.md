# Modular Tool Migration Inventory

Generated: 2026-07-10T05:55:44.029Z

## Summary

- Source repo: `C:/Work/mcp`
- Target repo: `C:/Work/mcp-tests`
- Total modular external tools: 63
- Existing exact/equivalent overlap: 63
- Missing in mcp-tests: 0

### By target surface

- `public`: 7
- `tests`: 56

### By safety

- `safe`: 45
- `unsafe`: 18

### By migration action

- `already_present`: 52
- `do_not_port_alias`: 1
- `keep_existing`: 8
- `rename_on_port`: 2

## Review-first items

- none

## Overlap resolutions

- `append_file` -> `append_file` : `already_present`
- `build_index` -> `build_index` : `already_present`
- `change_workflow_simulator` -> `change_workflow_simulator` : `already_present`
- `check_npm_package` -> `net_check_npm_package` : `merged_into_existing_keep_existing`
- `check_pypi_package` -> `net_check_pypi_package` : `merged_into_existing_keep_existing`
- `code_apply_patch` -> `code_apply_patch` : `already_present`
- `code_audit` -> `dev_code_audit` : `prefer_existing`
- `code_dependencies` -> `dev_code_dependencies` : `prefer_existing`
- `code_impact` -> `dev_code_impact` : `prefer_existing`
- `code_orchestrate` -> `code_orchestrate` : `already_present`
- `code_patch_plan` -> `code_patch_plan` : `already_present`
- `code_rollback_patch` -> `code_rollback_patch` : `already_present`
- `code_runtime_map` -> `code_runtime_map` : `already_present`
- `code_scenario` -> `code_scenario` : `already_present`
- `code_symbols` -> `dev_code_symbols` : `prefer_existing`
- `collect_context` -> `collect_context` : `already_present`
- `collect_romionsim_context` -> `collect_romionsim_context` : `already_present`
- `copy_path` -> `copy_path` : `already_present`
- `delete_path` -> `delete_path` : `already_present`
- `delete_remote_site_file` -> `delete_remote_site_file` : `already_present`
- `deploy_decision_guard` -> `deploy_decision_guard` : `already_present`
- `edit_file_patch` -> `edit_file_patch` : `already_present`
- `edit_remote_site_file` -> `edit_remote_site_file` : `already_present`
- `fetch` -> `fetch` : `keep_existing_and_port_renamed`
- `fetch_github_file` -> `net_fetch_github_raw` : `prefer_existing`
- `fits_info` -> `fits_info` : `already_present`
- `get_info` -> `get_info` : `already_present`
- `hdf5_info` -> `hdf5_info` : `already_present`
- `http_get` -> `net_http_get_allowlisted` : `prefer_existing`
- `index_status` -> `index_status` : `already_present`
- `inventory_tree` -> `inventory_tree` : `already_present`
- `list_directory` -> `list_directory` : `already_present`
- `list_remote_site_files` -> `list_remote_site_files` : `already_present`
- `move_path` -> `move_path` : `already_present`
- `move_remote_site_file` -> `move_remote_site_file` : `already_present`
- `preview_remote_site_retention` -> `preview_remote_site_retention` : `already_present`
- `process_runner_status` -> `process_runner_status` : `already_present`
- `project_truth_audit` -> `project_truth_audit` : `already_present`
- `pypi_info` -> `net_check_pypi_package` : `merge_unique_fields`
- `read_file` -> `read_file` : `already_present`
- `read_file_chunk` -> `read_file_chunk` : `already_present`
- `read_file_lines` -> `read_file_lines` : `already_present`
- `read_remote_site_file` -> `read_remote_site_file` : `already_present`
- `remote_site_runtime_status` -> `remote_site_runtime_status` : `already_present`
- `restore_path` -> `restore_path` : `already_present`
- `restore_remote_site_file` -> `restore_remote_site_file` : `already_present`
- `run_process` -> `run_process` : `already_present`
- `search` -> `search` : `keep_existing_and_port_renamed`
- `search_index` -> `search_index` : `already_present`
- `search_index_context` -> `search_index_context` : `already_present`
- `table_profile` -> `table_profile` : `already_present`
- `tool_dispatch` -> `tool_dispatch` : `already_present`
- `tool_registry_execute` -> `tool_registry_execute` : `already_present`
- `tool_registry_get_tool` -> `tool_registry_get_tool` : `already_present`
- `tool_registry_list` -> `tool_registry_list` : `already_present`
- `tool_registry_plan` -> `tool_registry_plan` : `already_present`
- `tool_registry_policy` -> `tool_registry_policy` : `already_present`
- `tool_registry_preflight` -> `tool_registry_preflight` : `already_present`
- `tool_registry_status` -> `tool_registry_status` : `already_present`
- `tool_registry_validate_tool` -> `tool_registry_validate_tool` : `already_present`
- `tool_usage_snapshot` -> `tool_usage_snapshot` : `already_present`
- `write_file` -> `write_file` : `already_present`
- `write_remote_site_file` -> `write_remote_site_file` : `already_present`

## Inventory

| tool | family | safety | target surface | overlap | resolution | action |
| --- | --- | --- | --- | --- | --- | --- |
| `append_file` | `filesystem_mutation` | `unsafe` | `tests` | `exact_tests:append_file` | `-` | `already_present` |
| `build_index` | `index` | `unsafe` | `tests` | `exact_tests:build_index` | `-` | `already_present` |
| `change_workflow_simulator` | `truth` | `safe` | `tests` | `exact_tests:change_workflow_simulator` | `-` | `already_present` |
| `check_npm_package` | `web` | `safe` | `public` | `capability_overlap:net_check_npm_package` | `merged_into_existing_keep_existing` | `keep_existing` |
| `check_pypi_package` | `web` | `safe` | `public` | `capability_overlap:net_check_pypi_package` | `merged_into_existing_keep_existing` | `keep_existing` |
| `code_apply_patch` | `code` | `unsafe` | `tests` | `exact_tests:code_apply_patch` | `-` | `already_present` |
| `code_audit` | `code` | `safe` | `tests` | `capability_overlap:dev_code_audit` | `prefer_existing` | `keep_existing` |
| `code_dependencies` | `code` | `safe` | `tests` | `capability_overlap:dev_code_dependencies` | `prefer_existing` | `keep_existing` |
| `code_impact` | `code` | `safe` | `tests` | `capability_overlap:dev_code_impact` | `prefer_existing` | `keep_existing` |
| `code_orchestrate` | `code` | `unsafe` | `tests` | `exact_tests:code_orchestrate` | `-` | `already_present` |
| `code_patch_plan` | `code` | `safe` | `tests` | `exact_tests:code_patch_plan` | `-` | `already_present` |
| `code_rollback_patch` | `code` | `unsafe` | `tests` | `exact_tests:code_rollback_patch` | `-` | `already_present` |
| `code_runtime_map` | `truth` | `safe` | `tests` | `exact_tests:code_runtime_map` | `-` | `already_present` |
| `code_scenario` | `code` | `safe` | `tests` | `exact_tests:code_scenario` | `-` | `already_present` |
| `code_symbols` | `code` | `safe` | `tests` | `capability_overlap:dev_code_symbols` | `prefer_existing` | `keep_existing` |
| `collect_context` | `index` | `safe` | `tests` | `exact_tests:collect_context` | `-` | `already_present` |
| `collect_romionsim_context` | `index` | `safe` | `tests` | `exact_tests:collect_romionsim_context` | `-` | `already_present` |
| `copy_path` | `filesystem_mutation` | `unsafe` | `tests` | `exact_tests:copy_path` | `-` | `already_present` |
| `delete_path` | `filesystem_mutation` | `unsafe` | `tests` | `exact_tests:delete_path` | `-` | `already_present` |
| `delete_remote_site_file` | `remote_site_file_ops` | `unsafe` | `tests` | `exact_tests:delete_remote_site_file` | `-` | `already_present` |
| `deploy_decision_guard` | `truth` | `safe` | `tests` | `exact_tests:deploy_decision_guard` | `-` | `already_present` |
| `edit_file_patch` | `filesystem_patch` | `unsafe` | `tests` | `exact_tests:edit_file_patch` | `-` | `already_present` |
| `edit_remote_site_file` | `remote_site_file_ops` | `unsafe` | `tests` | `exact_tests:edit_remote_site_file` | `-` | `already_present` |
| `fetch` | `connector` | `safe` | `public` | `name_conflict_semantic_divergence:fetch` | `keep_existing_and_port_renamed` | `rename_on_port` |
| `fetch_github_file` | `web` | `safe` | `public` | `capability_overlap:net_fetch_github_raw` | `prefer_existing` | `keep_existing` |
| `fits_info` | `science` | `safe` | `tests` | `exact_tests:fits_info` | `-` | `already_present` |
| `get_info` | `filesystem_read` | `safe` | `tests` | `exact_tests:get_info` | `-` | `already_present` |
| `hdf5_info` | `science` | `safe` | `tests` | `exact_tests:hdf5_info` | `-` | `already_present` |
| `http_get` | `web` | `safe` | `public` | `capability_overlap:net_http_get_allowlisted` | `prefer_existing` | `keep_existing` |
| `index_status` | `index` | `safe` | `tests` | `exact_tests:index_status` | `-` | `already_present` |
| `inventory_tree` | `science` | `safe` | `tests` | `exact_tests:inventory_tree` | `-` | `already_present` |
| `list_directory` | `filesystem_read` | `safe` | `tests` | `exact_tests:list_directory` | `-` | `already_present` |
| `list_remote_site_files` | `remote_site_file_ops` | `safe` | `tests` | `exact_tests:list_remote_site_files` | `-` | `already_present` |
| `move_path` | `filesystem_mutation` | `unsafe` | `tests` | `exact_tests:move_path` | `-` | `already_present` |
| `move_remote_site_file` | `remote_site_file_ops` | `unsafe` | `tests` | `exact_tests:move_remote_site_file` | `-` | `already_present` |
| `preview_remote_site_retention` | `remote_site_runtime` | `safe` | `tests` | `exact_tests:preview_remote_site_retention` | `-` | `already_present` |
| `process_runner_status` | `process` | `safe` | `tests` | `exact_tests:process_runner_status` | `-` | `already_present` |
| `project_truth_audit` | `truth` | `safe` | `tests` | `exact_tests:project_truth_audit` | `-` | `already_present` |
| `pypi_info` | `web` | `safe` | `public` | `capability_overlap:net_check_pypi_package` | `merge_unique_fields` | `do_not_port_alias` |
| `read_file` | `filesystem_read` | `safe` | `tests` | `exact_tests:read_file` | `-` | `already_present` |
| `read_file_chunk` | `filesystem_read` | `safe` | `tests` | `exact_tests:read_file_chunk` | `-` | `already_present` |
| `read_file_lines` | `filesystem_read` | `safe` | `tests` | `exact_tests:read_file_lines` | `-` | `already_present` |
| `read_remote_site_file` | `remote_site_file_ops` | `safe` | `tests` | `exact_tests:read_remote_site_file` | `-` | `already_present` |
| `remote_site_runtime_status` | `remote_site_runtime` | `safe` | `tests` | `exact_tests:remote_site_runtime_status` | `-` | `already_present` |
| `restore_path` | `filesystem_mutation` | `unsafe` | `tests` | `exact_tests:restore_path` | `-` | `already_present` |
| `restore_remote_site_file` | `remote_site_file_ops` | `unsafe` | `tests` | `exact_tests:restore_remote_site_file` | `-` | `already_present` |
| `run_process` | `process` | `unsafe` | `tests` | `exact_tests:run_process` | `-` | `already_present` |
| `search` | `connector` | `safe` | `public` | `name_conflict_semantic_divergence:search` | `keep_existing_and_port_renamed` | `rename_on_port` |
| `search_index` | `index` | `safe` | `tests` | `exact_tests:search_index` | `-` | `already_present` |
| `search_index_context` | `index` | `safe` | `tests` | `exact_tests:search_index_context` | `-` | `already_present` |
| `table_profile` | `science` | `safe` | `tests` | `exact_tests:table_profile` | `-` | `already_present` |
| `tool_dispatch` | `code` | `unsafe` | `tests` | `exact_tests:tool_dispatch` | `-` | `already_present` |
| `tool_registry_execute` | `registry` | `safe` | `tests` | `exact_tests:tool_registry_execute` | `-` | `already_present` |
| `tool_registry_get_tool` | `registry` | `safe` | `tests` | `exact_tests:tool_registry_get_tool` | `-` | `already_present` |
| `tool_registry_list` | `registry` | `safe` | `tests` | `exact_tests:tool_registry_list` | `-` | `already_present` |
| `tool_registry_plan` | `registry` | `safe` | `tests` | `exact_tests:tool_registry_plan` | `-` | `already_present` |
| `tool_registry_policy` | `registry` | `safe` | `tests` | `exact_tests:tool_registry_policy` | `-` | `already_present` |
| `tool_registry_preflight` | `registry` | `safe` | `tests` | `exact_tests:tool_registry_preflight` | `-` | `already_present` |
| `tool_registry_status` | `code` | `safe` | `tests` | `exact_tests:tool_registry_status` | `-` | `already_present` |
| `tool_registry_validate_tool` | `registry` | `safe` | `tests` | `exact_tests:tool_registry_validate_tool` | `-` | `already_present` |
| `tool_usage_snapshot` | `truth` | `safe` | `tests` | `exact_tests:tool_usage_snapshot` | `-` | `already_present` |
| `write_file` | `filesystem_mutation` | `unsafe` | `tests` | `exact_tests:write_file` | `-` | `already_present` |
| `write_remote_site_file` | `remote_site_file_ops` | `unsafe` | `tests` | `exact_tests:write_remote_site_file` | `-` | `already_present` |
