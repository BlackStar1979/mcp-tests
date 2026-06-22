"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { getToolPolicy } = require("./tool_policy");

function loadServerToolsSpec({ rootDir = path.resolve(__dirname, "..") } = {}) {
  const specPath = path.join(rootDir, "SERVER_TOOLS_SPEC.json");
  const parsed = JSON.parse(fs.readFileSync(specPath, "utf8"));
  if (!parsed || typeof parsed !== "object" || !parsed.tool_catalog || typeof parsed.tool_catalog !== "object") {
    throw new Error("SERVER_TOOLS_SPEC.json missing tool_catalog.");
  }
  return parsed;
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function summarizeDescriptor(descriptor) {
  return {
    name: descriptor?.name || null,
    title: descriptor?.title || null,
    description: descriptor?.description || null,
    input_schema_type: descriptor?.inputSchema?.type || null,
    output_schema_present: Boolean(descriptor?.outputSchema),
    annotation_summary: descriptor?.annotations ? {
      readOnlyHint: descriptor.annotations.readOnlyHint,
      destructiveHint: descriptor.annotations.destructiveHint,
      idempotentHint: descriptor.annotations.idempotentHint,
      openWorldHint: descriptor.annotations.openWorldHint,
    } : null,
  };
}

function summarizeToolPolicy(policy) {
  if (!policy) return null;
  return {
    profile_allowed: Array.isArray(policy.profile_allowed) ? policy.profile_allowed.slice() : [],
    read_only: Boolean(policy.read_only),
    destructive: Boolean(policy.destructive),
    open_world: Boolean(policy.open_world),
    uses_network: Boolean(policy.uses_network),
    uses_fs: Boolean(policy.uses_fs),
    fs_scope: policy.fs_scope || "none",
    auth_required: Boolean(policy.auth_required),
    public_safe: Boolean(policy.public_safe),
  };
}

function summarizeCatalogEntry(entry) {
  if (!entry) return null;
  return {
    name: entry.name || null,
    surface_class: entry.surface_class || entry.surface || null,
    tool_category: entry.tool_category || entry.category || null,
    resource_class: entry.resource_class || null,
    operation_class: entry.operation_class || null,
    resource_policy_refs: Array.isArray(entry.resource_policy_refs) ? entry.resource_policy_refs.slice() : [],
    memory_policy_ref: entry.memory_policy_ref || null,
    network_policy_ref: entry.network_policy_ref || null,
    database_policy_ref: entry.database_policy_ref || null,
    plugin_visibility_policy_ref: entry.plugin_visibility_policy_ref || null,
    audit_required: Boolean(entry.audit_required),
    auth_required: Boolean(entry.auth_required),
    public_safe: entry.public_safe === undefined ? null : Boolean(entry.public_safe),
  };
}

function buildRegistryPolicyReadModel({ registry, toolsSpec, rootDir } = {}) {
  if (!registry || typeof registry.entries !== "function") {
    throw new Error("registry_policy_read_model requires a registry with entries().");
  }
  const spec = toolsSpec || loadServerToolsSpec({ rootDir });
  const catalog = spec.tool_catalog || {};
  const entries = registry.entries().map((entry) => {
    const descriptor = registry.getDescriptor(entry.name) || entry.descriptor;
    const policy = getToolPolicy(entry.name);
    const catalogEntry = catalog[entry.name] || null;
    return Object.freeze({
      name: entry.name,
      source: entry.source,
      descriptor,
      descriptor_summary: summarizeDescriptor(descriptor),
      tool_policy: policy,
      tool_policy_summary: summarizeToolPolicy(policy),
      catalog_entry: catalogEntry,
      catalog_summary: summarizeCatalogEntry(catalogEntry),
    });
  });

  const errors = [];
  const names = entries.map((entry) => entry.name);
  for (const entry of entries) {
    if (!entry.descriptor || entry.descriptor.name !== entry.name) {
      errors.push(`${entry.name}: descriptor mismatch`);
    }
    if (!entry.tool_policy) {
      errors.push(`${entry.name}: missing TOOL_POLICIES entry`);
    }
    if (!entry.catalog_entry) {
      errors.push(`${entry.name}: missing SERVER_TOOLS_SPEC.tool_catalog entry`);
    } else if (entry.catalog_entry.name !== entry.name) {
      errors.push(`${entry.name}: catalog name mismatch`);
    }
    if (entry.tool_policy_summary && entry.catalog_summary) {
      if (entry.catalog_summary.surface_class === "public_mcp_tools" && entry.tool_policy_summary.public_safe !== true) {
        errors.push(`${entry.name}: public catalog entry is not public_safe in tool policy`);
      }
      if (entry.catalog_summary.operation_class === "read" && entry.tool_policy_summary.read_only !== true) {
        errors.push(`${entry.name}: read catalog entry is not read_only in tool policy`);
      }
      if (entry.catalog_summary.operation_class === "write" && entry.tool_policy_summary.read_only === true) {
        errors.push(`${entry.name}: write catalog entry is marked read_only in tool policy`);
      }
    }
  }

  const frozenEntries = Object.freeze(entries.slice());
  const byName = new Map(frozenEntries.map((entry) => [entry.name, entry]));

  return Object.freeze({
    schema_version: "stage8-registry-policy-read-model-v1",
    ok: errors.length === 0,
    errors,
    tool_count: names.length,
    names,
    entries() {
      return frozenEntries.slice();
    },
    get(name) {
      return byName.get(name) || null;
    },
    snapshot({ includeEntries = false } = {}) {
      const snapshot = {
        schema_version: "stage8-registry-policy-read-model-snapshot-v1",
        ok: errors.length === 0,
        tool_count: names.length,
        names: names.slice(),
        missing_tool_policy: frozenEntries.filter((entry) => !entry.tool_policy).map((entry) => entry.name),
        missing_catalog_entry: frozenEntries.filter((entry) => !entry.catalog_entry).map((entry) => entry.name),
        errors: errors.slice(),
      };
      if (includeEntries) {
        snapshot.entries = frozenEntries.map((entry) => ({
          name: entry.name,
          source: entry.source,
          descriptor_summary: cloneJson(entry.descriptor_summary),
          tool_policy_summary: cloneJson(entry.tool_policy_summary),
          catalog_summary: cloneJson(entry.catalog_summary),
        }));
      }
      return snapshot;
    },
  });
}

module.exports = {
  buildRegistryPolicyReadModel,
  loadServerToolsSpec,
  summarizeCatalogEntry,
  summarizeDescriptor,
  summarizeToolPolicy,
};
