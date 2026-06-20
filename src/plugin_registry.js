const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { PUBLIC_TOOL_NAMES } = require("./tool_policy");
const { classifyToolRisk, validatePluginManifest } = require("./plugin_policy");

const PLUGINS_ROOT = path.resolve(__dirname, "..", "plugins");
const MANIFEST_FILE = "plugin.manifest.json";
const MAX_PLUGINS = 100;

function sha256Text(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function safeManifestPath(pluginDirName) {
  if (!/^[a-zA-Z0-9_.-]{1,120}$/.test(pluginDirName)) {
    throw new Error(`Invalid plugin directory name: ${pluginDirName}`);
  }
  return path.join(PLUGINS_ROOT, pluginDirName, MANIFEST_FILE);
}

async function discoverManifestFiles() {
  try {
    const entries = await fsp.readdir(PLUGINS_ROOT, { withFileTypes: true });
    const out = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
      const manifestPath = safeManifestPath(entry.name);
      if (fs.existsSync(manifestPath)) out.push({ plugin_dir: entry.name, manifest_path: manifestPath });
      if (out.length >= MAX_PLUGINS) break;
    }
    return out;
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function summarizeManifest(manifest, validation, sourceInfo, rawText) {
  const tools = Array.isArray(manifest?.tools) ? manifest.tools : [];
  const risks = tools.map((tool) => classifyToolRisk(tool));
  return {
    plugin_id: validation.plugin_id || manifest?.plugin_id || "",
    plugin_version: manifest?.plugin_version || "",
    name: manifest?.name || "",
    description: manifest?.description || "",
    status: manifest?.status || "invalid",
    plugin_dir: sourceInfo.plugin_dir,
    manifest_path: path.relative(path.resolve(__dirname, ".."), sourceInfo.manifest_path).replace(/\\/g, "/"),
    manifest_sha256: sha256Text(rawText),
    profile_allowed: Array.isArray(manifest?.profile_allowed) ? manifest.profile_allowed : [],
    public_safe: Boolean(manifest?.public_safe),
    tags: Array.isArray(manifest?.tags) ? manifest.tags : [],
    tool_count: tools.length,
    tool_names: validation.tool_names,
    risk_summary: risks.reduce((acc, risk) => {
      acc[risk] = (acc[risk] || 0) + 1;
      return acc;
    }, {}),
    tools: tools.map((tool) => ({
      name: tool?.name || "",
      title: tool?.title || "",
      description: tool?.description || "",
      profile_allowed: Array.isArray(tool?.profile_allowed) ? tool.profile_allowed : [],
      public_safe: Boolean(tool?.public_safe),
      risk: classifyToolRisk(tool),
      annotations: tool?.annotations || {},
      permissions: tool?.permissions || {},
      has_input_schema: Boolean(tool?.inputSchema),
      has_output_schema: Boolean(tool?.outputSchema),
      input_schema: tool?.inputSchema || null,
      output_schema: tool?.outputSchema || null,
      execution: tool?.execution || null,
    })),
    validation,
  };
}

async function loadOneManifest(sourceInfo, reservedToolNames) {
  let rawText = "";
  let manifest = null;
  let parseError = "";
  try {
    rawText = await fsp.readFile(sourceInfo.manifest_path, "utf8");
    manifest = JSON.parse(rawText);
  } catch (error) {
    parseError = error?.message || String(error);
  }

  const validation = parseError
    ? { ok: false, source: sourceInfo.manifest_path, plugin_id: "", tool_names: [], errors: [`manifest parse/read error: ${parseError}`], warnings: [] }
    : validatePluginManifest(manifest, {
        source: sourceInfo.manifest_path,
        reservedToolNames,
      });

  return summarizeManifest(manifest || {}, validation, sourceInfo, rawText);
}

function applyCrossManifestChecks(plugins, reservedToolNames) {
  const errors = [];
  const warnings = [];
  const byPluginId = new Map();
  const byToolName = new Map();

  for (const plugin of plugins) {
    if (plugin.plugin_id) {
      const existing = byPluginId.get(plugin.plugin_id);
      if (existing) {
        errors.push(`duplicate plugin_id: ${plugin.plugin_id} in ${existing.plugin_dir} and ${plugin.plugin_dir}`);
      } else {
        byPluginId.set(plugin.plugin_id, plugin);
      }
    }

    for (const toolName of plugin.tool_names || []) {
      if (reservedToolNames.has(toolName)) {
        errors.push(`plugin tool collides with active/core tool: ${toolName}`);
      }
      const existing = byToolName.get(toolName);
      if (existing) {
        errors.push(`duplicate plugin tool name: ${toolName} in ${existing.plugin_id} and ${plugin.plugin_id}`);
      } else {
        byToolName.set(toolName, plugin);
      }
    }
  }

  return { errors, warnings };
}

async function buildPluginRegistry(options = {}) {
  const reservedToolNames = new Set(options.reservedToolNames || PUBLIC_TOOL_NAMES);
  const files = await discoverManifestFiles();
  const plugins = [];

  for (const sourceInfo of files) {
    plugins.push(await loadOneManifest(sourceInfo, reservedToolNames));
  }

  const cross = applyCrossManifestChecks(plugins, reservedToolNames);
  const manifestErrors = plugins.flatMap((plugin) => plugin.validation.errors.map((error) => `${plugin.plugin_id || plugin.plugin_dir}: ${error}`));
  const manifestWarnings = plugins.flatMap((plugin) => plugin.validation.warnings.map((warning) => `${plugin.plugin_id || plugin.plugin_dir}: ${warning}`));
  const validPlugins = plugins.filter((plugin) => plugin.validation.ok);
  const candidateTools = validPlugins.flatMap((plugin) => plugin.tools.map((tool) => ({
    plugin_id: plugin.plugin_id,
    plugin_version: plugin.plugin_version,
    plugin_status: plugin.status,
    tool_name: tool.name,
    title: tool.title,
    risk: tool.risk,
    public_safe: tool.public_safe,
    profile_allowed: tool.profile_allowed,
  })));

  const errors = [...manifestErrors, ...cross.errors];
  const warnings = [...manifestWarnings, ...cross.warnings];

  return {
    registry_version: "test-mcp-plugin-registry-v1",
    mode: "preview-only",
    plugins_root: path.relative(path.resolve(__dirname, ".."), PLUGINS_ROOT).replace(/\\/g, "/"),
    discovered_count: plugins.length,
    valid_count: validPlugins.length,
    invalid_count: plugins.length - validPlugins.length,
    candidate_tool_count: candidateTools.length,
    executable_tool_count: 0,
    dynamic_import_enabled: false,
    list_changed_enabled: false,
    ok: errors.length === 0,
    errors,
    warnings,
    plugins,
    candidate_tools: candidateTools,
  };
}

async function getPluginRegistryStatus() {
  const registry = await buildPluginRegistry();
  return {
    registry_version: registry.registry_version,
    mode: registry.mode,
    plugins_root: registry.plugins_root,
    discovered_count: registry.discovered_count,
    valid_count: registry.valid_count,
    invalid_count: registry.invalid_count,
    candidate_tool_count: registry.candidate_tool_count,
    executable_tool_count: registry.executable_tool_count,
    dynamic_import_enabled: registry.dynamic_import_enabled,
    list_changed_enabled: registry.list_changed_enabled,
    ok: registry.ok,
    errors: registry.errors,
    warnings: registry.warnings,
  };
}

async function listPluginRegistry() {
  const registry = await buildPluginRegistry();
  return registry;
}

async function getPlugin(pluginId) {
  const registry = await buildPluginRegistry();
  const plugin = registry.plugins.find((item) => item.plugin_id === pluginId || item.plugin_dir === pluginId);
  if (!plugin) {
    return { success: false, plugin_id: String(pluginId || ""), error: "Plugin not found.", plugin: null };
  }
  return { success: true, plugin_id: plugin.plugin_id, error: "", plugin };
}

async function auditPluginRegistry() {
  const registry = await buildPluginRegistry();
  const riskCounts = {};
  for (const tool of registry.candidate_tools) {
    riskCounts[tool.risk] = (riskCounts[tool.risk] || 0) + 1;
  }
  return {
    success: true,
    ok: registry.ok,
    mode: registry.mode,
    discovered_count: registry.discovered_count,
    valid_count: registry.valid_count,
    invalid_count: registry.invalid_count,
    candidate_tool_count: registry.candidate_tool_count,
    executable_tool_count: registry.executable_tool_count,
    risk_counts: riskCounts,
    errors: registry.errors,
    warnings: registry.warnings,
  };
}

module.exports = {
  MANIFEST_FILE,
  PLUGINS_ROOT,
  auditPluginRegistry,
  buildPluginRegistry,
  getPlugin,
  getPluginRegistryStatus,
  listPluginRegistry,
};
