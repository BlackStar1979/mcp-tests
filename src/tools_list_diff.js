const crypto = require("node:crypto");

function normalizeToolName(value) {
  return String(value || "").trim();
}

function normalizeToolList(values = []) {
  const seen = new Set();
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const name = normalizeToolName(value);
    if (!/^[a-zA-Z0-9_.-]{1,160}$/.test(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out.sort();
}

function hashToolList(values = []) {
  return crypto.createHash("sha256").update(normalizeToolList(values).join("\n")).digest("hex").slice(0, 16);
}

function diffToolLists({ current = [], target = [] } = {}) {
  const currentTools = normalizeToolList(current);
  const targetTools = normalizeToolList(target);
  const currentSet = new Set(currentTools);
  const targetSet = new Set(targetTools);
  const add = targetTools.filter((name) => !currentSet.has(name));
  const remove = currentTools.filter((name) => !targetSet.has(name));
  const unchanged = currentTools.filter((name) => targetSet.has(name));
  const changes = add.length + remove.length;

  return {
    success: true,
    mode: "tools-list-diff-preview-only",
    current_tool_count: currentTools.length,
    target_tool_count: targetTools.length,
    add_count: add.length,
    remove_count: remove.length,
    unchanged_count: unchanged.length,
    change_count: changes,
    current_tools_hash: hashToolList(currentTools),
    target_tools_hash: hashToolList(targetTools),
    add,
    remove,
    unchanged,
    would_change_tools_list: changes > 0,
    would_require_list_changed: changes > 0,
    list_changed_enabled_now: false,
    execute_allowed_now: false,
    real_mutation_enabled: false,
    required_approvals: changes > 0
      ? [
          "tools/list diff review",
          "explicit operator approval",
          "client refresh or notifications/tools/list_changed workflow",
        ]
      : [],
    blockers: changes > 0
      ? [
          "real tools/list mutation is disabled",
          "notifications/tools/list_changed emission is disabled",
        ]
      : [],
    warnings: changes > 0 ? ["diff is preview-only and must not be applied in the current mode"] : [],
  };
}

function buildTargetToolListFromVisibilityPlan({ current = [], plan } = {}) {
  const currentTools = normalizeToolList(current);
  const target = new Set(currentTools);

  const add = Array.isArray(plan?.planned_diff?.add_to_tools_list) ? plan.planned_diff.add_to_tools_list : [];
  const remove = Array.isArray(plan?.planned_diff?.remove_from_tools_list) ? plan.planned_diff.remove_from_tools_list : [];

  for (const name of add) {
    const toolName = normalizeToolName(name);
    if (toolName) target.add(toolName);
  }
  for (const name of remove) {
    const toolName = normalizeToolName(name);
    if (toolName) target.delete(toolName);
  }

  return normalizeToolList([...target]);
}

function planToolsListDiffForVisibilityPlan({ current = [], plan } = {}) {
  const target = buildTargetToolListFromVisibilityPlan({ current, plan });
  const diff = diffToolLists({ current, target });
  return {
    ...diff,
    source: "plugin_visibility_plan",
    source_success: Boolean(plan?.success),
    source_tool_name: String(plan?.tool_name || ""),
    source_target_state: String(plan?.target_state || ""),
  };
}

module.exports = {
  buildTargetToolListFromVisibilityPlan,
  diffToolLists,
  hashToolList,
  normalizeToolList,
  planToolsListDiffForVisibilityPlan,
};
