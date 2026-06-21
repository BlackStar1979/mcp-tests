const VALID_PROFILES = new Set(["public", "internal"]);

const PUBLIC_TOOL_NAMES = [
  "search",
  "fetch",
  "net_http_get_allowlisted",
  "net_fetch_text_allowlisted",
  "net_check_url_head",
  "net_fetch_github_raw",
  "net_check_npm_package",
  "net_check_pypi_package",
  "fs_list_public",
  "fs_get_public_info",
  "fs_read_public_text",
  "fs_read_public_lines",
  "fs_read_public_chunk",
];

const AUTHORIZED_MCP_TOOL_NAMES = [
  "test_mcp_runtime_status",
  "code_sample_js",
  "dev_code_symbols",
  "dev_code_dependencies",
  "dev_code_audit",
  "dev_code_impact",
  "dev_code_syntax_check",
  "dev_code_locate",
  "plugin_registry_status",
  "plugin_registry_list",
  "plugin_registry_get",
  "plugin_registry_audit",
  "plugin_catalog_search",
  "plugin_catalog_describe",
  "plugin_visibility_status",
  "plugin_visibility_plan",
  "session_toolset_status",
  "session_toolset_plan",
  "plugin_execution_preflight",
  "plugin_execute_readonly",
  "plugin_execution_governance",
  "plugin_execution_verify_receipt",
  "auth_legacy_retirement_status",
  "observability_status",
  "memory_save",
  "memory_search",
  "memory_get_state",
  "memory_set_state",
  "memory_create_task",
  "memory_get_tasks",
];

const TOOL_POLICIES = Object.freeze({
  // ── Shared agent memory (authorized/authenticated surface only) ─────────────
  memory_save:        policy({ profileAllowed: ["internal"], authRequired: true, publicSafe: false, usesFs: true, fsScope: "agent-memory-store", readOnly: false }),
  memory_search:      policy({ profileAllowed: ["internal"], authRequired: true, publicSafe: false, usesFs: true, fsScope: "agent-memory-store" }),
  memory_get_state:   policy({ profileAllowed: ["internal"], authRequired: true, publicSafe: false, usesFs: true, fsScope: "agent-memory-store" }),
  memory_set_state:   policy({ profileAllowed: ["internal"], authRequired: true, publicSafe: false, usesFs: true, fsScope: "agent-memory-store", readOnly: false }),
  memory_create_task: policy({ profileAllowed: ["internal"], authRequired: true, publicSafe: false, usesFs: true, fsScope: "agent-memory-store", readOnly: false }),
  memory_get_tasks:   policy({ profileAllowed: ["internal"], authRequired: true, publicSafe: false, usesFs: true, fsScope: "agent-memory-store" }),
  // ── Existing tools ───────────────────────────────────────────────────────
  search: policy({ usesNetwork: false, usesFs: false, fsScope: "none" }),
  fetch: policy({ usesNetwork: false, usesFs: false, fsScope: "none" }),
  code_sample_js: policy({ usesNetwork: false, usesFs: true, fsScope: "workspace-js-ts-sampler" }),
  net_http_get_allowlisted: policy({ usesNetwork: true, openWorld: true }),
  net_fetch_text_allowlisted: policy({ usesNetwork: true, openWorld: true }),
  net_check_url_head: policy({ usesNetwork: true, openWorld: true }),
  net_fetch_github_raw: policy({ usesNetwork: true, openWorld: true }),
  net_check_npm_package: policy({ usesNetwork: true, openWorld: true }),
  net_check_pypi_package: policy({ usesNetwork: true, openWorld: true }),
  fs_list_public: policy({ usesFs: true, fsScope: "public-fs-sandbox" }),
  fs_get_public_info: policy({ usesFs: true, fsScope: "public-fs-sandbox" }),
  fs_read_public_text: policy({ usesFs: true, fsScope: "public-fs-sandbox" }),
  fs_read_public_lines: policy({ usesFs: true, fsScope: "public-fs-sandbox" }),
  fs_read_public_chunk: policy({ usesFs: true, fsScope: "public-fs-sandbox" }),
  test_mcp_runtime_status: policy({ usesNetwork: false, usesFs: false, fsScope: "none" }),
  dev_code_symbols: policy({ usesFs: true, fsScope: "workspace-code-inspection" }),
  dev_code_dependencies: policy({ usesFs: true, fsScope: "workspace-code-inspection" }),
  dev_code_audit: policy({ usesFs: true, fsScope: "workspace-code-inspection" }),
  dev_code_impact: policy({ usesFs: true, fsScope: "workspace-code-inspection" }),
  dev_code_syntax_check: policy({ usesFs: true, fsScope: "workspace-code-validation" }),
  dev_code_locate: policy({ usesFs: true, fsScope: "workspace-code-inspection" }),
  plugin_registry_status: policy({ usesFs: true, fsScope: "plugin-registry-preview" }),
  plugin_registry_list: policy({ usesFs: true, fsScope: "plugin-registry-preview" }),
  plugin_registry_get: policy({ usesFs: true, fsScope: "plugin-registry-preview" }),
  plugin_registry_audit: policy({ usesFs: true, fsScope: "plugin-registry-preview" }),
  plugin_catalog_search: policy({ usesFs: true, fsScope: "plugin-catalog-preview" }),
  plugin_catalog_describe: policy({ usesFs: true, fsScope: "plugin-catalog-preview" }),
  plugin_visibility_status: policy({ usesFs: true, fsScope: "plugin-visibility-preview" }),
  plugin_visibility_plan: policy({ usesFs: true, fsScope: "plugin-visibility-preview" }),
  session_toolset_status: policy({ usesFs: true, fsScope: "session-toolset-preview" }),
  session_toolset_plan: policy({ usesFs: true, fsScope: "session-toolset-preview" }),
  plugin_execution_preflight: policy({ usesFs: true, fsScope: "plugin-execution-wrapper" }),
  plugin_execute_readonly: policy({ usesFs: true, fsScope: "plugin-execution-wrapper" }),
  plugin_execution_governance: policy({ usesFs: false, fsScope: "none" }),
  plugin_execution_verify_receipt: policy({ usesFs: false, fsScope: "none" }),
  auth_legacy_retirement_status: policy({ usesFs: false, fsScope: "none" }),
  observability_status: policy({ usesFs: true, fsScope: "observability-audit-preview" }),
});

function policy(overrides = {}) {
  return Object.freeze({
    profile_allowed: overrides.profileAllowed || ["public", "internal"],
    read_only: overrides.readOnly ?? true,
    destructive: overrides.destructive ?? false,
    open_world: overrides.openWorld ?? false,
    uses_network: overrides.usesNetwork ?? false,
    uses_fs: overrides.usesFs ?? false,
    fs_scope: overrides.fsScope || "none",
    auth_required: overrides.authRequired ?? false,
    public_safe: overrides.publicSafe ?? true,
    workspace_fs: overrides.workspaceFs ?? false,
    aitool: overrides.aiTool ?? false,
  });
}

function getRuntimeProfile() {
  const profile = String(process.env.MCP_TEST_PROFILE || "public").trim().toLowerCase();
  if (!VALID_PROFILES.has(profile)) {
    throw new Error(`Invalid MCP_TEST_PROFILE: ${profile}. Allowed values: public, internal.`);
  }
  return profile;
}

function getToolPolicy(toolName) {
  return TOOL_POLICIES[toolName] || null;
}

function assertToolAllowedInProfile(toolName, profile = getRuntimeProfile()) {
  const toolPolicy = getToolPolicy(toolName);

  if (!toolPolicy) {
    throw new Error(`Missing policy for tool: ${toolName}`);
  }

  if (!toolPolicy.profile_allowed.includes(profile)) {
    throw new Error(`Tool ${toolName} is not allowed in ${profile} profile.`);
  }

  if (profile === "public") {
    if (!PUBLIC_TOOL_NAMES.includes(toolName)) {
      throw new Error(`Tool ${toolName} is not a public MCP tool.`);
    }

    if (!toolPolicy.public_safe) {
      throw new Error(`Tool ${toolName} is not public_safe.`);
    }

    if (toolPolicy.workspace_fs) {
      throw new Error(`Tool ${toolName} uses workspace FS and is not allowed in public profile.`);
    }

    if (toolPolicy.aitool) {
      throw new Error(`Tool ${toolName} is an AI tool and is not allowed in public profile.`);
    }

    if (toolPolicy.uses_fs && toolPolicy.fs_scope !== "public-fs-sandbox") {
      throw new Error(`Tool ${toolName} has invalid public FS scope: ${toolPolicy.fs_scope}`);
    }
  }

  return true;
}

function auditProfilePolicy(tools, context = {}) {
  const profile = context.profile || getRuntimeProfile();
  const authMode = context.authMode || "none";
  const errors = [];
  const toolNames = tools.map((tool) => tool.name);

  for (const tool of tools) {
    const toolName = tool.name;
    const toolPolicy = getToolPolicy(toolName);

    if (!toolPolicy) {
      errors.push(`missing policy for tool: ${toolName}`);
      continue;
    }

    try {
      assertToolAllowedInProfile(toolName, profile);
    } catch (error) {
      errors.push(error.message || String(error));
    }

    if (tool.annotations) {
      if (tool.annotations.readOnlyHint !== toolPolicy.read_only) {
        errors.push(`${toolName} readOnly annotation does not match policy`);
      }
      if (tool.annotations.destructiveHint !== toolPolicy.destructive) {
        errors.push(`${toolName} destructive annotation does not match policy`);
      }
      if (tool.annotations.openWorldHint !== toolPolicy.open_world) {
        errors.push(`${toolName} openWorld annotation does not match policy`);
      }
    }
  }

  if (profile === "public" && authMode === "none") {
    for (const toolName of toolNames) {
      const toolPolicy = getToolPolicy(toolName);
      if (!toolPolicy?.public_safe) {
        errors.push(`auth none is not allowed with non-public-safe tool: ${toolName}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    profile,
    auth_mode: authMode,
    public_exposure: profile === "public",
    tool_count: toolNames.length,
    tool_names: toolNames,
    errors,
  };
}

function assertProfilePolicy(tools, context = {}) {
  const result = auditProfilePolicy(tools, context);
  if (!result.ok) {
    throw new Error(`profile policy audit failed: ${result.errors.join("; ")}`);
  }
  return result;
}

function summarizeToolPolicies(toolNames) {
  return toolNames.map((toolName) => {
    const toolPolicy = getToolPolicy(toolName);
    return {
      tool: toolName,
      profile_allowed: toolPolicy?.profile_allowed || [],
      read_only: Boolean(toolPolicy?.read_only),
      open_world: Boolean(toolPolicy?.open_world),
      uses_network: Boolean(toolPolicy?.uses_network),
      uses_fs: Boolean(toolPolicy?.uses_fs),
      fs_scope: toolPolicy?.fs_scope || "unknown",
      auth_required: Boolean(toolPolicy?.auth_required),
      public_safe: Boolean(toolPolicy?.public_safe),
    };
  });
}

module.exports = {
  PUBLIC_TOOL_NAMES,
  AUTHORIZED_MCP_TOOL_NAMES,
  NON_PUBLIC_MCP_TOOL_NAMES: AUTHORIZED_MCP_TOOL_NAMES,
  TOOL_POLICIES,
  VALID_PROFILES,
  assertProfilePolicy,
  assertToolAllowedInProfile,
  auditProfilePolicy,
  getRuntimeProfile,
  getToolPolicy,
  summarizeToolPolicies,
};
