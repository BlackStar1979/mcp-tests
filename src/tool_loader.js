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
  const createRuntimeStatusTool = options.createRuntimeStatusTool;
  const createObservabilityStatusTool = options.createObservabilityStatusTool;
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
    add("../tools/public/code_sample_js", "codeSampleJsTool", "code_sample_js");
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
    add("../tools/authorized/dev_code_syntax_check", "devCodeSyntaxCheckTool", "dev_code_syntax_check");
    add("../tools/authorized/dev_code_locate", "devCodeLocateTool", "dev_code_locate");
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_PLUGIN_EXECUTION_TOOLS", true)) {
    add("../tools/authorized/plugin_execution_governance", "pluginExecutionGovernanceTool", "plugin_execution_governance");
    add("../tools/authorized/auth_transition_status", "authTransitionStatusTool", "auth_transition_status");
    add("../tools/authorized/auth_bearer_dry_run", "authBearerDryRunTool", "auth_bearer_dry_run");
    add("../tools/authorized/auth_bearer_cutover_guard", "authBearerCutoverGuardTool", "auth_bearer_cutover_guard");
    add("../tools/authorized/auth_modular_parity_status", "authModularParityStatusTool", "auth_modular_parity_status");
    add("../tools/authorized/plugin_execution_verify_receipt", "pluginExecutionVerifyReceiptTool", "plugin_execution_verify_receipt");
    add("../tools/authorized/plugin_execution_preflight", "pluginExecutionPreflightTool", "plugin_execution_preflight");
    add("../tools/authorized/plugin_execute_readonly", "pluginExecuteReadonlyTool", "plugin_execute_readonly");
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_SESSION_TOOLSET_TOOLS", true)) {
    add("../tools/authorized/session_toolset_status", "sessionToolsetStatusTool", "session_toolset_status");
    add("../tools/authorized/session_toolset_plan", "sessionToolsetPlanTool", "session_toolset_plan");
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_PLUGIN_VISIBILITY_TOOLS", true)) {
    add("../tools/authorized/plugin_visibility_status", "pluginVisibilityStatusTool", "plugin_visibility_status");
    add("../tools/authorized/plugin_visibility_plan", "pluginVisibilityPlanTool", "plugin_visibility_plan");
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_PLUGIN_CATALOG_TOOLS", true)) {
    add("../tools/authorized/plugin_catalog_search", "pluginCatalogSearchTool", "plugin_catalog_search");
    add("../tools/authorized/plugin_catalog_describe", "pluginCatalogDescribeTool", "plugin_catalog_describe");
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_PLUGIN_REGISTRY_TOOLS", true)) {
    add("../tools/authorized/plugin_registry_status", "pluginRegistryStatusTool", "plugin_registry_status");
    add("../tools/authorized/plugin_registry_list", "pluginRegistryListTool", "plugin_registry_list");
    add("../tools/authorized/plugin_registry_get", "pluginRegistryGetTool", "plugin_registry_get");
    add("../tools/authorized/plugin_registry_audit", "pluginRegistryAuditTool", "plugin_registry_audit");
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_OBSERVABILITY_TOOLS", true)) {
    if (typeof createObservabilityStatusTool !== "function") {
      throw new Error("Observability status tool requested but createObservabilityStatusTool was not provided.");
    }
    assertToolAllowedInProfile("observability_status", profile);
    tools.push(createObservabilityStatusTool());
  }

  if (memoryToolsRequested && memoryToolsAllowed) {
    add("../tools/authorized/memory_save", "memorySaveTool", "memory_save");
    add("../tools/authorized/memory_search", "memorySearchTool", "memory_search");
    add("../tools/authorized/memory_get_state", "memoryGetStateTool", "memory_get_state");
    add("../tools/authorized/memory_set_state", "memorySetStateTool", "memory_set_state");
    add("../tools/authorized/memory_create_task", "memoryCreateTaskTool", "memory_create_task");
    add("../tools/authorized/memory_get_tasks", "memoryGetTasksTool", "memory_get_tasks");
  }

  if (groupEnabled("authorized") && envFlagEnabled("MCP_TEST_ENABLE_RUNTIME_STATUS", true)) {
    if (typeof createRuntimeStatusTool !== "function") {
      throw new Error("Runtime status tool requested but createRuntimeStatusTool was not provided.");
    }
    assertToolAllowedInProfile("test_mcp_runtime_status", profile);
    tools.push(createRuntimeStatusTool());
  }

  return tools;
}

module.exports = {
  envFlagEnabled,
  loadOptionalTools,
  requireTool,
};
