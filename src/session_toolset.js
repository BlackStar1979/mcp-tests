const { buildPluginRegistry } = require("./plugin_registry");
const { PUBLIC_TOOL_NAMES, getToolPolicy } = require("./tool_policy");

const VALID_PROFILES = new Set(["public", "internal"]);
const VALID_DETAIL_LEVELS = new Set(["summary", "full"]);

function gatewayFeasibility() {
  return {
    gateway_mode: "prototype-preview-only",
    gateway_server_enabled: false,
    session_store_enabled: false,
    per_session_tools_list_enabled: false,
    list_changed_enabled: false,
    current_transport: "single public HTTP connector on port 3009",
    readiness: "not-ready-for-real-session-mutation",
    blockers: [
      "no durable session store yet",
      "no per-session MCP server/transport abstraction yet",
      "no real enable/disable state store yet",
      "no notifications/tools/list_changed emission yet",
      "no authenticated internal connector selected for side-effect tools yet",
    ],
    future_requirements: [
      "session id and session lifecycle audit",
      "session-bound toolset registry view",
      "gateway transport or session-aware MCP server context",
      "state-backed visibility enable/disable/quarantine",
      "client refresh or notifications/tools/list_changed path",
      "rollback/quarantine path for bad toolset changes",
    ],
  };
}

function summarizeTool(toolName) {
  const policy = getToolPolicy(toolName);
  return {
    tool_name: toolName,
    source: "active-core",
    read_only: Boolean(policy?.read_only),
    public_safe: Boolean(policy?.public_safe),
    profile_allowed: policy?.profile_allowed || [],
    fs_scope: policy?.fs_scope || "none",
    uses_network: Boolean(policy?.uses_network),
    uses_fs: Boolean(policy?.uses_fs),
    auth_required: Boolean(policy?.auth_required),
  };
}

function filterCoreToolsForProfile(profile) {
  return PUBLIC_TOOL_NAMES
    .map(summarizeTool)
    .filter((tool) => tool.profile_allowed.includes(profile))
    .filter((tool) => profile !== "public" || tool.public_safe === true);
}

function candidateToolsForProfile(registry, profile, includePluginCandidates) {
  if (!includePluginCandidates) return [];
  const candidates = [];
  for (const plugin of registry.plugins || []) {
    if (!plugin.validation?.ok) continue;
    for (const tool of plugin.tools || []) {
      const allowed = Array.isArray(tool.profile_allowed) && tool.profile_allowed.includes(profile);
      if (!allowed) continue;
      if (profile === "public" && tool.public_safe !== true) continue;
      candidates.push({
        tool_name: tool.name,
        source: "plugin-candidate-preview",
        plugin_id: plugin.plugin_id,
        plugin_version: plugin.plugin_version,
        plugin_status: plugin.status,
        risk: tool.risk,
        read_only: tool.annotations?.readOnlyHint === true,
        public_safe: Boolean(tool.public_safe),
        profile_allowed: tool.profile_allowed || [],
        visible_in_real_tools_list: false,
        execution_enabled: false,
        would_require_enable: true,
        would_require_list_changed: true,
      });
    }
  }
  return candidates;
}

function detailToolset(tools, detailLevel) {
  if (detailLevel === "full") return tools;
  return tools.map((tool) => ({
    tool_name: tool.tool_name,
    source: tool.source,
    public_safe: tool.public_safe,
    read_only: tool.read_only,
    risk: tool.risk || "active-core",
  }));
}

async function getSessionToolsetStatus() {
  const registry = await buildPluginRegistry();
  const publicCore = filterCoreToolsForProfile("public");
  const internalCore = filterCoreToolsForProfile("internal");
  const publicCandidates = candidateToolsForProfile(registry, "public", true);
  const internalCandidates = candidateToolsForProfile(registry, "internal", true);

  return {
    success: true,
    error: "",
    session_toolset_version: "test-mcp-session-toolset-v1",
    mode: "session-toolset-preview-only",
    active_connector_profile: process.env.MCP_TEST_PROFILE || "public",
    gateway: gatewayFeasibility(),
    current_global_tool_surface_count: PUBLIC_TOOL_NAMES.length,
    profiles: {
      public: {
        active_core_tool_count: publicCore.length,
        candidate_plugin_tool_count: publicCandidates.length,
        real_session_mutation_enabled: false,
      },
      internal: {
        active_core_tool_count: internalCore.length,
        candidate_plugin_tool_count: internalCandidates.length,
        requires_auth: true,
        real_session_mutation_enabled: false,
      },
    },
    registry_ok: registry.ok,
    registry_errors: registry.errors || [],
    dynamic_import_enabled: false,
    plugin_execution_enabled: false,
    per_session_tools_list_enabled: false,
    list_changed_enabled: false,
  };
}

async function planSessionToolset(args = {}) {
  const profile = VALID_PROFILES.has(args.profile) ? args.profile : "public";
  const includePluginCandidates = Boolean(args.include_plugin_candidates);
  const detailLevel = VALID_DETAIL_LEVELS.has(args.detail_level) ? args.detail_level : "summary";
  const registry = await buildPluginRegistry();
  const coreTools = filterCoreToolsForProfile(profile);
  const candidateTools = candidateToolsForProfile(registry, profile, includePluginCandidates);
  const proposed = [...coreTools, ...candidateTools];

  const blockers = [];
  const warnings = [];
  if (!registry.ok) blockers.push("plugin registry is not valid");
  if (profile === "internal") warnings.push("internal session toolsets require bearer-authenticated connector or gateway session before real activation");
  if (includePluginCandidates) warnings.push("plugin candidates are preview-only and are not active tools/list entries");

  return {
    success: true,
    error: "",
    mode: "session-toolset-preview-only",
    profile,
    include_plugin_candidates: includePluginCandidates,
    detail_level: detailLevel,
    proposed_tool_count: proposed.length,
    active_core_tool_count: coreTools.length,
    candidate_plugin_tool_count: candidateTools.length,
    proposed_tools: detailToolset(proposed, detailLevel),
    real_session_mutation_enabled: false,
    gateway_server_enabled: false,
    per_session_tools_list_enabled: false,
    dynamic_import_enabled: false,
    plugin_execution_enabled: false,
    list_changed_enabled: false,
    would_require_gateway: includePluginCandidates || profile === "internal",
    would_require_list_changed: includePluginCandidates,
    would_require_auth: profile === "internal",
    blockers,
    warnings,
    gateway: gatewayFeasibility(),
  };
}

module.exports = {
  VALID_DETAIL_LEVELS,
  VALID_PROFILES,
  filterCoreToolsForProfile,
  gatewayFeasibility,
  getSessionToolsetStatus,
  planSessionToolset,
};
