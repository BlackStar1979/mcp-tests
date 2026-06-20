const { EMPTY_INPUT_SCHEMA, GENERIC_PLUGIN_REGISTRY_OUTPUT_SCHEMA, READ_ONLY_PLUGIN_REGISTRY_ANNOTATIONS } = require("../src/schemas/plugin_registry_tools");
const { auditPluginRegistry } = require("../src/plugin_registry");

const TOOL_NAME = "plugin_registry_audit";

async function execute() {
  try {
    return await auditPluginRegistry();
  } catch (error) {
    return { success: false, ok: false, mode: "preview-only", discovered_count: 0, valid_count: 0, invalid_count: 0, candidate_tool_count: 0, executable_tool_count: 0, risk_counts: {}, errors: [error?.message || String(error)], warnings: [] };
  }
}

const pluginRegistryAuditTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Audit plugin registry",
    description: "Read-only governance audit of TEST MCP plug-in manifests. Does not import or execute plug-in code.",
    inputSchema: EMPTY_INPUT_SCHEMA,
    outputSchema: GENERIC_PLUGIN_REGISTRY_OUTPUT_SCHEMA,
    annotations: READ_ONLY_PLUGIN_REGISTRY_ANNOTATIONS,
  },
  execute,
  summarizeArgs() { return { operation: "plugin_registry_audit" }; },
  resultStats(payload = {}) { return { result_count: payload.candidate_tool_count || 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { pluginRegistryAuditTool };
