const { buildPluginRegistry } = require("./plugin_registry");
const { lookupVisibilityState, planVisibilityStateTransition } = require("./plugin_visibility_state");
const { PUBLIC_TOOL_NAMES } = require("./tool_policy");

const VALID_TARGET_STATES = new Set(["enabled", "disabled", "quarantined", "candidate"]);

function getCandidateTools(registry) {
  return (registry.candidate_tools || []).map((tool) => ({
    plugin_id: tool.plugin_id,
    plugin_version: tool.plugin_version,
    plugin_status: tool.plugin_status,
    tool_name: tool.tool_name,
    title: tool.title,
    risk: tool.risk,
    public_safe: tool.public_safe,
    profile_allowed: tool.profile_allowed || [],
    current_visibility_state: tool.plugin_status || "candidate",
    visible_in_tools_list: false,
    execution_enabled: false,
  }));
}

function listChangedFeasibility() {
  return {
    list_changed_required_for_real_visibility_change: true,
    list_changed_enabled_now: false,
    current_connector_mode: "public-global-tool-surface",
    reason_disabled_now: "Preview-only mode. Current public connector keeps a static tools/list surface; real list_changed belongs to a future session/gateway runtime design.",
    future_requirements: [
      "manifest-backed state store",
      "explicit enable/disable operation with audit",
      "auth/internal profile for non-public-safe tools",
      "session-aware toolset or refresh workflow",
      "client refresh or notifications/tools/list_changed support",
      "rollback/quarantine path",
    ],
  };
}

function buildVisibilityStatusFromRegistry(registry) {
  const candidates = getCandidateTools(registry);
  const activeCoreTools = [...PUBLIC_TOOL_NAMES];
  const candidateByState = candidates.reduce((acc, candidate) => {
    const state = candidate.current_visibility_state || "candidate";
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, {});

  return {
    success: true,
    error: "",
    visibility_registry_version: "test-mcp-plugin-visibility-v1",
    mode: "visibility-preview-only",
    tool_surface_mutation_enabled: false,
    dynamic_import_enabled: false,
    plugin_execution_enabled: false,
    list_changed_enabled: false,
    active_core_tool_count: activeCoreTools.length,
    active_core_tools: activeCoreTools,
    candidate_tool_count: candidates.length,
    visible_candidate_tool_count: 0,
    executable_candidate_tool_count: 0,
    candidate_by_state: candidateByState,
    candidate_tools: candidates,
    registry_ok: registry.ok,
    registry_errors: registry.errors || [],
    list_changed: listChangedFeasibility(),
  };
}

async function getPluginVisibilityStatus() {
  const registry = await buildPluginRegistry();
  return buildVisibilityStatusFromRegistry(registry);
}

function canonicalVisibilityMessage(value) {
  const text = String(value || "").trim();
  if (/^explicit operator approval/.test(text)) return "explicit operator approval";
  if (/^visibility diff review|^tools\/list diff review/.test(text)) return "tools/list diff review";
  if (/client refresh|notifications\/tools\/list_changed/.test(text)) return "client refresh or notifications/tools/list_changed workflow";
  return text;
}

function makeFailurePlan({ error, toolName = "", targetState = "" } = {}) {
  return {
    success: false,
    error: String(error || "Plugin visibility plan failed."),
    mode: "visibility-preview-only",
    tool_name: String(toolName || ""),
    plugin_id: "",
    plugin_version: "",
    current_state: "unknown",
    target_state: String(targetState || ""),
    state_overlay: {
      state_store_version: "test-mcp-plugin-visibility-state-v1",
      source: "fallback",
      state_store_ok: false,
      state_store_error_count: 1,
      state_store_warning_count: 0,
      read_only_overlay: true,
      persisted_state_file_enabled: false,
    },
    current_visible_in_tools_list: false,
    target_visible_in_tools_list: false,
    would_change_tools_list: false,
    would_require_list_changed: false,
    real_mutation_enabled: false,
    plan_allowed_now: false,
    execute_allowed_now: false,
    dynamic_import_enabled: false,
    plugin_execution_enabled: false,
    list_changed_enabled: false,
    risk: "",
    public_safe: false,
    profile_allowed: [],
    blockers: [String(error || "Plugin visibility plan failed.")],
    warnings: [],
    required_approvals: [],
    planned_diff: { add_to_tools_list: [], remove_from_tools_list: [], state_change: { from: "unknown", to: String(targetState || "") } },
    list_changed: { list_changed_required_for_real_visibility_change: false, list_changed_enabled_now: false },
    next_stage_hint: "Inspect plugin_visibility_plan error before retrying.",
  };
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const item of values || []) {
    if (typeof item !== "string") continue;
    const text = item.trim();
    if (!text) continue;
    const key = canonicalVisibilityMessage(text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function makePlan({ candidate, targetState, registry, stateStore = {} }) {
  const stateOverlay = lookupVisibilityState(candidate.tool_name, stateStore);
  const currentState = stateOverlay.state || candidate.current_visibility_state || "candidate";
  const transitionPlan = planVisibilityStateTransition({
    toolName: candidate.tool_name,
    currentState,
    targetState,
  });
  const realMutationEnabled = false;
  const wouldChangeVisibility = transitionPlan.would_change_tools_list;
  const wouldBeVisible = targetState === "enabled";
  const blockers = [];
  const warnings = [];
  const requiredApprovals = [];

  if (!registry.ok) blockers.push("registry is not valid");
  if (!candidate.public_safe && candidate.profile_allowed.includes("public")) {
    blockers.push("non-public-safe candidate cannot be planned for public visibility");
  }
  if (targetState === "enabled") {
    requiredApprovals.push("explicit operator approval before any real enable action");
    requiredApprovals.push("visibility diff review before real tools/list change");
    if (!candidate.public_safe) requiredApprovals.push("internal authenticated profile required");
    if (candidate.risk !== "readonly-local") requiredApprovals.push(`risk-specific policy approval: ${candidate.risk}`);
  }
  if (targetState === "quarantined") {
    warnings.push("quarantine is safe to plan but preview-only mode does not persist state");
  }
  if (targetState === currentState) {
    warnings.push("target_state equals current manifest-derived state; real diff would be empty");
  }

  return {
    success: true,
    error: "",
    mode: "visibility-preview-only",
    tool_name: candidate.tool_name,
    plugin_id: candidate.plugin_id,
    plugin_version: candidate.plugin_version,
    current_state: currentState,
    target_state: targetState,
    state_overlay: {
      state_store_version: stateOverlay.state_store_version || "test-mcp-plugin-visibility-state-v1",
      source: stateOverlay.source,
      state_store_ok: stateOverlay.state_store_ok,
      state_store_error_count: (stateOverlay.state_store_errors || []).length,
      state_store_warning_count: (stateOverlay.state_store_warnings || []).length,
      read_only_overlay: true,
      persisted_state_file_enabled: false,
    },
    current_visible_in_tools_list: currentState === "enabled",
    target_visible_in_tools_list: wouldBeVisible,
    would_change_tools_list: wouldChangeVisibility,
    would_require_list_changed: wouldChangeVisibility,
    real_mutation_enabled: realMutationEnabled,
    plan_allowed_now: blockers.length === 0 && transitionPlan.success,
    execute_allowed_now: false,
    dynamic_import_enabled: false,
    plugin_execution_enabled: false,
    list_changed_enabled: false,
    risk: candidate.risk,
    public_safe: candidate.public_safe,
    profile_allowed: candidate.profile_allowed,
    blockers: uniqueStrings([...blockers, ...(transitionPlan.errors || [])]),
    warnings: uniqueStrings([...warnings, ...(transitionPlan.warnings || [])]),
    required_approvals: uniqueStrings([...requiredApprovals, ...(transitionPlan.required_approvals || [])]),
    planned_diff: {
      add_to_tools_list: targetState === "enabled" ? [candidate.tool_name] : [],
      remove_from_tools_list: currentState === "enabled" && targetState !== "enabled" ? [candidate.tool_name] : [],
      state_change: {
        from: currentState,
        to: targetState,
      },
    },
    list_changed: listChangedFeasibility(),
    next_stage_hint: "A future session/gateway prototype is required before server-pushed list_changed is meaningful for per-session toolsets.",
  };
}

async function planPluginVisibility(args = {}) {
  const toolName = String(args.tool_name || "").trim();
  const targetState = String(args.target_state || "enabled").trim();
  if (!VALID_TARGET_STATES.has(targetState)) {
    return makeFailurePlan({
      error: "Invalid target_state. Allowed: enabled, disabled, quarantined, candidate.",
      toolName,
      targetState,
    });
  }

  const registry = await buildPluginRegistry();
  const candidate = getCandidateTools(registry).find((item) => item.tool_name === toolName);
  if (!candidate) {
    return makeFailurePlan({
      error: "Candidate tool not found.",
      toolName,
      targetState,
    });
  }

  return makePlan({ candidate, targetState, registry, stateStore: args.state_store || {} });
}

module.exports = {
  VALID_TARGET_STATES,
  buildVisibilityStatusFromRegistry,
  getPluginVisibilityStatus,
  listChangedFeasibility,
  planPluginVisibility,
};
