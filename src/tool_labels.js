const fs = require("node:fs");
const path = require("node:path");

const TOOL_LABELS_VERSION = "test-mcp-labels-v1";
const PLUGINS_ROOT = path.resolve(__dirname, "..", "plugins");

const BASE_PUBLIC_TOOLS = new Set(["search", "fetch"]);

function normalizeStatus(enabled) {
  return enabled ? "enabled" : "disabled";
}

function classifyCoreTool(name) {
  if (BASE_PUBLIC_TOOLS.has(name)) return "public";
  if (name.startsWith("net_") || name.startsWith("fs_") || name === "code_sample_js") return "public";
  return "internal";
}

function buildCoreToolLabel(tool, enabledNames) {
  const name = tool?.name || "";
  const group = classifyCoreTool(name);
  const enabled = enabledNames.has(name);
  return {
    name,
    title: tool?.title || name,
    group,
    status: normalizeStatus(enabled),
    exposure: group === "public" ? "public-mcp-tool" : "non-public-mcp-tool",
    source: group === "public" ? "public-tool-facade" : "non-public-tool-facade",
    runtime_enabled: enabled,
    connector_visible: enabled,
    plugin_id: null,
    risk: null,
  };
}

function classifyPluginToolRisk(tool) {
  const permissions = tool?.permissions || {};
  if (permissions.destructive || permissions.write) return "destructive";
  if (permissions.process) return "process";
  if (permissions.network) return "network";
  if (permissions.fs) return "filesystem";
  return "readonly-local";
}

function buildPluginLabelsSync() {
  const labels = [];
  if (!fs.existsSync(PLUGINS_ROOT)) return labels;
  for (const entry of fs.readdirSync(PLUGINS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    const manifestPath = path.join(PLUGINS_ROOT, entry.name, "plugin.manifest.json");
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      for (const tool of Array.isArray(manifest.tools) ? manifest.tools : []) {
        labels.push({
          name: tool?.name || "",
          title: tool?.title || tool?.name || "",
          group: "plugin",
          status: manifest.status === "quarantined" ? "quarantined" : "candidate",
          exposure: "plugin-preview",
          source: "plugin-manifest",
          runtime_enabled: false,
          connector_visible: false,
          plugin_id: manifest.plugin_id || null,
          plugin_dir: entry.name,
          manifest_path: path.relative(path.resolve(__dirname, ".."), manifestPath).replace(/\\/g, "/"),
          risk: classifyPluginToolRisk(tool),
        });
      }
    } catch (error) {
      labels.push({
        name: `${entry.name}:manifest_error`,
        title: "Plugin manifest error",
        group: "plugin",
        status: "invalid",
        exposure: "plugin-preview",
        source: "plugin-manifest",
        runtime_enabled: false,
        connector_visible: false,
        plugin_id: null,
        plugin_dir: entry.name,
        manifest_path: path.relative(path.resolve(__dirname, ".."), manifestPath).replace(/\\/g, "/"),
        risk: null,
        error: error?.message || String(error),
      });
    }
  }
  return labels;
}

function buildToolLabelsSync(tools) {
  const enabledNames = new Set((tools || []).map((tool) => tool.name));
  const labels = {
    version: TOOL_LABELS_VERSION,
    public: [],
    internal: [],
    plugins: buildPluginLabelsSync(),
  };

  for (const tool of tools || []) {
    const label = buildCoreToolLabel(tool, enabledNames);
    labels[label.group].push(label);
  }

  labels.public.sort((a, b) => a.name.localeCompare(b.name));
  labels.internal.sort((a, b) => a.name.localeCompare(b.name));
  labels.plugins.sort((a, b) => `${a.plugin_id || ""}:${a.name}`.localeCompare(`${b.plugin_id || ""}:${b.name}`));

  return labels;
}

module.exports = {
  TOOL_LABELS_VERSION,
  buildPluginLabelsSync,
  buildToolLabelsSync,
  classifyCoreTool,
};
