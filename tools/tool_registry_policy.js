const {
  READ_ONLY_TOOL_REGISTRY_ANNOTATIONS,
  TOOL_NAME_INPUT_SCHEMA,
  TOOL_REGISTRY_POLICY_OUTPUT_SCHEMA,
} = require("../src/schemas/tool_registry_tools");
const { validateRegistryEntry } = require("../src/tool_registry_runtime");

const TOOL_NAME = "tool_registry_policy";

function createToolRegistryPolicyTool(getRuntimeRegistryContext) {
  return {
    name: TOOL_NAME,
    descriptor: {
      name: TOOL_NAME,
      title: "Tool registry policy detail",
      description: "Read-only descriptor, tool-policy, and catalog-policy detail for one currently loaded TEST MCP tool.",
      inputSchema: TOOL_NAME_INPUT_SCHEMA,
      outputSchema: TOOL_REGISTRY_POLICY_OUTPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_REGISTRY_ANNOTATIONS,
    },
    async execute(args = {}) {
      try {
        const entry = validateRegistryEntry(getRuntimeRegistryContext, args.tool, { label: "tool_registry_policy" });
        return {
          success: true,
          error: "",
          status: entry.status,
          connector_safe: true,
          dispatch_enabled: false,
          registry_version: entry.registry_version,
          registry_id: entry.registry_id,
          tool: String(args.tool || ""),
          found: entry.found,
          enabled: entry.enabled,
          allowed: entry.allowed,
          reason: entry.reason,
          descriptor_summary: entry.descriptor_summary,
          tool_policy_summary: entry.tool_policy_summary,
          catalog_summary: entry.catalog_summary,
        };
      } catch (error) {
        return { success: false, error: error?.message || String(error), status: "error", connector_safe: true, dispatch_enabled: false, registry_version: "", registry_id: "", tool: String(args.tool || ""), found: false, enabled: false, allowed: false, reason: "policy_error", descriptor_summary: null, tool_policy_summary: null, catalog_summary: null };
      }
    },
    summarizeArgs(args = {}) { return { tool: String(args.tool || "") }; },
    resultStats(payload = {}) { return { result_count: payload.found ? 1 : 0, result_chars: JSON.stringify(payload || {}).length }; },
  };
}

module.exports = { createToolRegistryPolicyTool };
