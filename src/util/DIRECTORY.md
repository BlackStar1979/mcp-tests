# DIRECTORY

Status: source util directory map
Updated: 2026-08-01

- `code_workspace.js`, `workspace_roots.js`, `workspace_index.js`, `workspace_fs.js`, `workspace_mutation.js`
  Workspace discovery, freshness-aware knowledge indexing and ranking, filesystem, and mutation helpers.
- `network_policy.js`, `path_policy.js`, `process_runner.js`, `process_runner_config.js`, `process_execution.js`, `process_job_manager.js`, `process_job_store.js`, `process_tool_errors.js`
  Shared runtime policy, pinned command resolution, process execution, durable SQLite job lifecycle, and controlled process-tool error helpers.
- `content_stage_manager.js`, `content_stage_store.js`
  Owner-isolated durable SQLite staging for bounded generated content chunks.
- `code_mutation_tools.js`, `remote_site_tools.js`, `science_tools.js`
  Utility helpers shared by code-mutation, remote-site, and science tooling.
- `science_scripts/`
  Supporting scripts for the science-tool area.
- `README.md`
  Orientation for the util area.
