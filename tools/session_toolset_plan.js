const { GENERIC_SESSION_TOOLSET_OUTPUT_SCHEMA, READ_ONLY_SESSION_TOOLSET_ANNOTATIONS, SESSION_TOOLSET_PLAN_INPUT_SCHEMA } = require("../src/schemas/session_toolset_tools");
const { planSessionToolset } = require("../src/session_toolset");

const TOOL_NAME = "session_toolset_plan";

async function execute(args = {}) {
  try {
    return await planSessionToolset(args);
  } catch (error) {
    return { success: false, error: error?.message || String(error), mode: "session-toolset-preview-only", profile: String(args.profile || "public"), proposed_tool_count: 0, real_session_mutation_enabled: false, gateway_server_enabled: false, per_session_tools_list_enabled: false, dynamic_import_enabled: false, plugin_execution_enabled: false, list_changed_enabled: false };
  }
}

const sessionToolsetPlanTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Plan session toolset",
    description: "Read-only deterministic preview for a future per-session/per-profile TEST MCP toolset. Does not mutate tools/list or execute plug-ins.",
    inputSchema: SESSION_TOOLSET_PLAN_INPUT_SCHEMA,
    outputSchema: GENERIC_SESSION_TOOLSET_OUTPUT_SCHEMA,
    annotations: READ_ONLY_SESSION_TOOLSET_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) { return { profile: String(args.profile || "public"), include_plugin_candidates: Boolean(args.include_plugin_candidates) }; },
  resultStats(payload = {}) { return { result_count: payload.proposed_tool_count || 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { sessionToolsetPlanTool };
