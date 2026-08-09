"use strict";

function envFlagEnabled(name, defaultValue = true) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") {
    return defaultValue;
  }
  return ["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase());
}

function requireTool(modulePath, exportName, expectedName) {
  const loaded = require(modulePath);
  const tool = loaded[exportName];
  if (!tool || tool.name !== expectedName || !tool.descriptor || typeof tool.execute !== "function") {
    throw new Error(`Invalid ${expectedName} tool export.`);
  }
  return tool;
}

function loadOptionalTools(options = {}) {
  const tools = [];
  const profile = options.profile || "public";
  const authMode = String(options.authMode || options.authPolicy?.mode || "none").trim().toLowerCase();
  const authRequired = Boolean(options.authPolicy?.requiresAuth) || authMode !== "none";
  const serverProfileConfig = options.serverProfileConfig || null;
  const serverProfileSurface = serverProfileConfig?.surface || null;
  const serverProfileGroups = new Set(Array.isArray(serverProfileSurface?.optional_tool_groups) ? serverProfileSurface.optional_tool_groups : []);
  const memoryToolsRequested = serverProfileConfig ? serverProfileSurface?.include_memory_tools === true : options.memoryToolsEnabled === true;
  const memoryToolsAllowed = profile === "internal" && authRequired;
  const { assertToolAllowedInProfile } = require("./tool_policy");

  function add(modulePath, exportName, expectedName) {
    assertToolAllowedInProfile(expectedName, profile);
    tools.push(requireTool(modulePath, exportName, expectedName));
  }

  function groupEnabled(group) {
    if (!serverProfileConfig) return true;
    return serverProfileGroups.has(group);
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_CODE_SAMPLE_JS", true)) {
    add("../tools/authorized/code_sample_js", "codeSampleJsTool", "code_sample_js");
  }

  if (profile === "internal" && authRequired && groupEnabled("authorized")) {
    add("../tools/authorized/cbm_status", "cbmStatusTool", "cbm_status");
    add("../tools/authorized/cbm_list_projects", "cbmListProjectsTool", "cbm_list_projects");
    add("../tools/authorized/cbm_index_repository", "cbmIndexRepositoryTool", "cbm_index_repository");
    add("../tools/authorized/cbm_get_architecture", "cbmGetArchitectureTool", "cbm_get_architecture");
    add("../tools/authorized/cbm_search_graph", "cbmSearchGraphTool", "cbm_search_graph");
    add("../tools/authorized/cbm_query_graph", "cbmQueryGraphTool", "cbm_query_graph");
    add("../tools/authorized/cbm_trace_path", "cbmTracePathTool", "cbm_trace_path");
    add("../tools/authorized/cbm_get_code_snippet", "cbmGetCodeSnippetTool", "cbm_get_code_snippet");
    add("../tools/authorized/cbm_get_graph_schema", "cbmGetGraphSchemaTool", "cbm_get_graph_schema");
    add("../tools/authorized/cbm_search_code", "cbmSearchCodeTool", "cbm_search_code");
    add("../tools/authorized/cbm_delete_project", "cbmDeleteProjectTool", "cbm_delete_project");
    add("../tools/authorized/cbm_index_status", "cbmIndexStatusTool", "cbm_index_status");
    add("../tools/authorized/cbm_detect_changes", "cbmDetectChangesTool", "cbm_detect_changes");
    add("../tools/authorized/cbm_manage_adr", "cbmManageAdrTool", "cbm_manage_adr");
    add("../tools/authorized/cbm_ingest_traces", "cbmIngestTracesTool", "cbm_ingest_traces");
  }

  if (groupEnabled("public") && envFlagEnabled("MCP_TEST_ENABLE_NET_TOOLS", true)) {
    add("../tools/public/net_http_get_allowlisted", "netHttpGetAllowlistedTool", "net_http_get_allowlisted");
    add("../tools/public/net_fetch_text_allowlisted", "netFetchTextAllowlistedTool", "net_fetch_text_allowlisted");
    add("../tools/public/net_check_url_head", "netCheckUrlHeadTool", "net_check_url_head");
    add("../tools/public/net_fetch_github_raw", "netFetchGithubRawTool", "net_fetch_github_raw");
    add("../tools/public/net_check_npm_package", "netCheckNpmPackageTool", "net_check_npm_package");
    add("../tools/public/net_check_pypi_package", "netCheckPypiPackageTool", "net_check_pypi_package");
  }

  if (groupEnabled("public") && envFlagEnabled("MCP_TEST_ENABLE_FS_TOOLS", true)) {
    add("../tools/public/fs_list_public", "fsListPublicTool", "fs_list_public");
    add("../tools/public/fs_get_public_info", "fsGetPublicInfoTool", "fs_get_public_info");
    add("../tools/public/fs_read_public_text", "fsReadPublicTextTool", "fs_read_public_text");
    add("../tools/public/fs_read_public_lines", "fsReadPublicLinesTool", "fs_read_public_lines");
    add("../tools/public/fs_read_public_chunk", "fsReadPublicChunkTool", "fs_read_public_chunk");
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_DEV_TOOLS", true)) {
    add("../tools/authorized/dev_code_symbols", "devCodeSymbolsTool", "dev_code_symbols");
    add("../tools/authorized/dev_code_dependencies", "devCodeDependenciesTool", "dev_code_dependencies");
    add("../tools/authorized/dev_code_audit", "devCodeAuditTool", "dev_code_audit");
    add("../tools/authorized/dev_code_impact", "devCodeImpactTool", "dev_code_impact");
    add("../tools/authorized/code_patch_plan", "codePatchPlanTool", "code_patch_plan");
    add("../tools/authorized/code_orchestrate", "codeOrchestrateTool", "code_orchestrate");
    add("../tools/authorized/code_scenario", "codeScenarioTool", "code_scenario");
    add("../tools/authorized/dev_code_syntax_check", "devCodeSyntaxCheckTool", "dev_code_syntax_check");
    add("../tools/authorized/dev_code_locate", "devCodeLocateTool", "dev_code_locate");
    add("../tools/authorized/tool_dispatch", "toolDispatchTool", "tool_dispatch");
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_WORKSPACE_FS_TOOLS", true)) {
    add("../tools/authorized/get_info", "getInfoTool", "get_info");
    add("../tools/authorized/list_directory", "listDirectoryTool", "list_directory");
    add("../tools/authorized/read_file", "readFileTool", "read_file");
    add("../tools/authorized/read_file_lines", "readFileLinesTool", "read_file_lines");
    add("../tools/authorized/read_file_chunk", "readFileChunkTool", "read_file_chunk");
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_SCIENCE_TOOLS", true)) {
    add("../tools/authorized/fits_info", "fitsInfoTool", "fits_info");
    add("../tools/authorized/hdf5_info", "hdf5InfoTool", "hdf5_info");
    add("../tools/authorized/inventory_tree", "inventoryTreeTool", "inventory_tree");
    add("../tools/authorized/table_profile", "tableProfileTool", "table_profile");
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_REMOTE_SITE_TOOLS", true)) {
    add("../tools/authorized/list_remote_site_files", "listRemoteSiteFilesTool", "list_remote_site_files");
    add("../tools/authorized/read_remote_site_file", "readRemoteSiteFileTool", "read_remote_site_file");
    add("../tools/authorized/remote_site_runtime_status", "remoteSiteRuntimeStatusTool", "remote_site_runtime_status");
    add("../tools/authorized/preview_remote_site_retention", "previewRemoteSiteRetentionTool", "preview_remote_site_retention");
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_REMOTE_SITE_MUTATION_TOOLS", true)) {
    add("../tools/authorized/write_remote_site_file", "writeRemoteSiteFileTool", "write_remote_site_file");
    add("../tools/authorized/edit_remote_site_file", "editRemoteSiteFileTool", "edit_remote_site_file");
    add("../tools/authorized/delete_remote_site_file", "deleteRemoteSiteFileTool", "delete_remote_site_file");
    add("../tools/authorized/move_remote_site_file", "moveRemoteSiteFileTool", "move_remote_site_file");
    add("../tools/authorized/restore_remote_site_file", "restoreRemoteSiteFileTool", "restore_remote_site_file");
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_WORKSPACE_MUTATION_TOOLS", true)) {
    add("../tools/authorized/write_file", "writeFileTool", "write_file");
    add("../tools/authorized/append_file", "appendFileTool", "append_file");
    add("../tools/authorized/copy_path", "copyPathTool", "copy_path");
    add("../tools/authorized/move_path", "movePathTool", "move_path");
    add("../tools/authorized/delete_path", "deletePathTool", "delete_path");
    add("../tools/authorized/restore_path", "restorePathTool", "restore_path");
    add("../tools/authorized/edit_file_patch", "editFilePatchTool", "edit_file_patch");
    add("../tools/authorized/code_apply_patch", "codeApplyPatchTool", "code_apply_patch");
    add("../tools/authorized/code_rollback_patch", "codeRollbackPatchTool", "code_rollback_patch");
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_TRUTH_TOOLS", true)) {
    add("../tools/authorized/project_truth_audit", "projectTruthAuditTool", "project_truth_audit");
    add("../tools/authorized/code_runtime_map", "codeRuntimeMapTool", "code_runtime_map");
    add("../tools/authorized/deploy_decision_guard", "deployDecisionGuardTool", "deploy_decision_guard");
    add("../tools/authorized/change_workflow_simulator", "changeWorkflowSimulatorTool", "change_workflow_simulator");
    add("../tools/authorized/tool_usage_snapshot", "toolUsageSnapshotTool", "tool_usage_snapshot");
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_WORKSPACE_INDEX_TOOLS", true)) {
    add("../tools/authorized/build_index", "buildIndexTool", "build_index");
    add("../tools/authorized/index_status", "indexStatusTool", "index_status");
    add("../tools/authorized/search_index", "searchIndexTool", "search_index");
    add("../tools/authorized/search_index_context", "searchIndexContextTool", "search_index_context");
    add("../tools/authorized/collect_context", "collectContextTool", "collect_context");
    add("../tools/authorized/collect_romionsim_context", "collectRomionsimContextTool", "collect_romionsim_context");
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_PROCESS_EXECUTION_TOOL", true)) {
    add("../tools/authorized/run_process", "runProcessTool", "run_process");
    add("../tools/authorized/process_start", "processStartTool", "process_start");
    add("../tools/authorized/process_status", "processStatusTool", "process_status");
    add("../tools/authorized/process_output", "processOutputTool", "process_output");
    add("../tools/authorized/process_cancel", "processCancelTool", "process_cancel");
  }

  if (memoryToolsRequested && memoryToolsAllowed) {
    add("../tools/authorized/memory_save", "memorySaveTool", "memory_save");
    add("../tools/authorized/memory_search", "memorySearchTool", "memory_search");
    add("../tools/authorized/memory_get_state", "memoryGetStateTool", "memory_get_state");
    add("../tools/authorized/memory_set_state", "memorySetStateTool", "memory_set_state");
    add("../tools/authorized/memory_create_task", "memoryCreateTaskTool", "memory_create_task");
    add("../tools/authorized/memory_get_tasks", "memoryGetTasksTool", "memory_get_tasks");
    add("../tools/authorized/memory_update_task", "memoryUpdateTaskTool", "memory_update_task");
  }

  return tools;
}

module.exports = {
  envFlagEnabled,
  loadOptionalTools,
  requireTool,
};
