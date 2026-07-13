# DIRECTORY

Status: authorized tools facade directory map
Updated: 2026-07-12

- `read_file.js`, `read_file_lines.js`, `read_file_chunk.js`, `write_file.js`, `append_file.js`, `edit_file_patch.js`
  Authorized workspace file-read and file-mutation facades.
- `copy_path.js`, `move_path.js`, `delete_path.js`, `restore_path.js`, `list_directory.js`, `get_info.js`, `inventory_tree.js`
  Authorized workspace path and inventory facades.
- `search_index.js`, `search_index_context.js`, `build_index.js`, `index_status.js`
  Authorized workspace indexing and search facades.
- `dev_code_audit.js`, `dev_code_dependencies.js`, `dev_code_impact.js`, `dev_code_locate.js`, `dev_code_symbols.js`, `dev_code_syntax_check.js`
  Authorized code-analysis facades.
- `code_apply_patch.js`, `code_patch_plan.js`, `code_rollback_patch.js`, `code_orchestrate.js`, `code_runtime_map.js`, `code_scenario.js`, `code_sample_js.js`
  Authorized code-change planning and execution facades.
- `memory_create_task.js`, `memory_get_state.js`, `memory_get_tasks.js`, `memory_save.js`, `memory_search.js`, `memory_set_state.js`
  Authorized memory/task facades.
- `plugin_catalog_describe.js`, `plugin_catalog_search.js`, `plugin_execute_readonly.js`, `plugin_execution_governance.js`, `plugin_execution_preflight.js`, `plugin_execution_verify_receipt.js`, `plugin_registry_audit.js`, `plugin_registry_get.js`, `plugin_registry_list.js`, `plugin_registry_status.js`, `plugin_visibility_plan.js`, `plugin_visibility_status.js`
  Authorized plugin governance and registry facades.
- `test_mcp_runtime_status.js`, `observability_status.js`, `tool_usage_snapshot.js`, `project_truth_audit.js`, `change_workflow_simulator.js`
  Authorized observability and truth-audit facades.
- `remote_site_runtime_status.js`, `list_remote_site_files.js`, `read_remote_site_file.js`, `write_remote_site_file.js`, `edit_remote_site_file.js`, `move_remote_site_file.js`, `delete_remote_site_file.js`, `restore_remote_site_file.js`, `preview_remote_site_retention.js`
  Authorized remote-site facades.
- `run_process.js`, `process_runner_status.js`, `tool_dispatch.js`, `tool_registry_execute.js`, `tool_registry_get_tool.js`, `tool_registry_list.js`, `tool_registry_plan.js`, `tool_registry_policy.js`, `tool_registry_preflight.js`, `tool_registry_status.js`, `tool_registry_validate_tool.js`
  Authorized execution, dispatch, and tool-registry facades.
- `README.md`
  Orientation for the authorized tool-facade layer.

This directory is intentionally grouped because the authorized surface is broad and still being normalized away from flat legacy targets.
