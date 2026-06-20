const { buildPluginRegistry } = require("./plugin_registry");

const DETAIL_LEVELS = new Set(["name", "summary", "full"]);
const MAX_RESULTS = 50;

function asLower(value) {
  return String(value || "").toLowerCase();
}

function includesText(haystack, needle) {
  if (!needle) return true;
  return asLower(haystack).includes(asLower(needle));
}

function scoreCandidate(candidate, query) {
  const q = asLower(query).trim();
  if (!q) return 1;
  let score = 0;
  const fields = [
    candidate.tool_name,
    candidate.title,
    candidate.description,
    candidate.plugin_id,
    candidate.plugin_name,
    candidate.plugin_description,
    ...(candidate.tags || []),
  ];
  for (const field of fields) {
    const text = asLower(field);
    if (text === q) score += 100;
    else if (text.startsWith(q)) score += 50;
    else if (text.includes(q)) score += 10;
  }
  return score;
}

function flattenCandidateTools(registry) {
  const out = [];
  for (const plugin of registry.plugins || []) {
    for (const tool of plugin.tools || []) {
      out.push({
        plugin_id: plugin.plugin_id,
        plugin_version: plugin.plugin_version,
        plugin_name: plugin.name,
        plugin_description: plugin.description,
        plugin_status: plugin.status,
        plugin_tags: plugin.tags || [],
        manifest_sha256: plugin.manifest_sha256,
        tool_name: tool.name,
        title: tool.title,
        description: tool.description,
        profile_allowed: tool.profile_allowed || [],
        public_safe: Boolean(tool.public_safe),
        risk: tool.risk,
        annotations: tool.annotations || {},
        permissions: tool.permissions || {},
        has_input_schema: Boolean(tool.has_input_schema),
        has_output_schema: Boolean(tool.has_output_schema),
        validation_ok: Boolean(plugin.validation?.ok),
        tags: plugin.tags || [],
      });
    }
  }
  return out;
}

function detailCandidate(candidate, detailLevel = "summary") {
  if (detailLevel === "name") {
    return {
      tool_name: candidate.tool_name,
      title: candidate.title,
      plugin_id: candidate.plugin_id,
      risk: candidate.risk,
    };
  }
  if (detailLevel === "summary") {
    return {
      tool_name: candidate.tool_name,
      title: candidate.title,
      description: candidate.description,
      plugin_id: candidate.plugin_id,
      plugin_version: candidate.plugin_version,
      plugin_status: candidate.plugin_status,
      risk: candidate.risk,
      public_safe: candidate.public_safe,
      profile_allowed: candidate.profile_allowed,
      tags: candidate.tags,
    };
  }
  return candidate;
}

function filterCandidates(candidates, args = {}) {
  const query = String(args.query || "").trim();
  const profile = String(args.profile || "").trim();
  const risk = String(args.risk || "").trim();
  const tag = String(args.tag || "").trim();
  const pluginId = String(args.plugin_id || "").trim();

  return candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, query) }))
    .filter((item) => item.score > 0)
    .filter((item) => !profile || item.candidate.profile_allowed.includes(profile))
    .filter((item) => !risk || item.candidate.risk === risk)
    .filter((item) => !tag || (item.candidate.tags || []).some((candidateTag) => includesText(candidateTag, tag)))
    .filter((item) => !pluginId || item.candidate.plugin_id === pluginId)
    .sort((a, b) => b.score - a.score || a.candidate.tool_name.localeCompare(b.candidate.tool_name));
}

async function searchPluginCatalog(args = {}) {
  const detailLevel = DETAIL_LEVELS.has(args.detail_level) ? args.detail_level : "summary";
  const limit = Math.max(1, Math.min(MAX_RESULTS, Number(args.max_results || 10)));
  const registry = await buildPluginRegistry();
  const candidates = flattenCandidateTools(registry);
  const filtered = filterCandidates(candidates, args);
  const results = filtered.slice(0, limit).map((item) => detailCandidate(item.candidate, detailLevel));

  return {
    success: true,
    error: "",
    mode: "catalog-preview-only",
    query: String(args.query || ""),
    detail_level: detailLevel,
    total_candidates: candidates.length,
    matched_count: filtered.length,
    returned_count: results.length,
    dynamic_import_enabled: false,
    executable_tool_count: 0,
    list_changed_enabled: false,
    results,
  };
}

async function describePluginCatalogTool(args = {}) {
  const toolName = String(args.tool_name || "").trim();
  const detailLevel = DETAIL_LEVELS.has(args.detail_level) ? args.detail_level : "full";
  const registry = await buildPluginRegistry();
  const candidates = flattenCandidateTools(registry);
  const candidate = candidates.find((item) => item.tool_name === toolName);
  if (!candidate) {
    return {
      success: false,
      error: "Catalog tool not found.",
      mode: "catalog-preview-only",
      tool_name: toolName,
      dynamic_import_enabled: false,
      executable_tool_count: 0,
      list_changed_enabled: false,
      tool: null,
    };
  }
  return {
    success: true,
    error: "",
    mode: "catalog-preview-only",
    tool_name: toolName,
    detail_level: detailLevel,
    dynamic_import_enabled: false,
    executable_tool_count: 0,
    list_changed_enabled: false,
    tool: detailCandidate(candidate, detailLevel),
  };
}

module.exports = {
  DETAIL_LEVELS,
  describePluginCatalogTool,
  flattenCandidateTools,
  searchPluginCatalog,
};
