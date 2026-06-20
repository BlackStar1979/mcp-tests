const { EMPTY_INPUT_SCHEMA, GENERIC_SESSION_TOOLSET_OUTPUT_SCHEMA, READ_ONLY_SESSION_TOOLSET_ANNOTATIONS } = require("../src/schemas/session_toolset_tools");
const { getSessionToolsetStatus } = require("../src/session_toolset");

const TOOL_NAME = "session_toolset_status";

async function execute() {
  try {
    return await getSessionToolsetStatus();
  } catch (error) {
    return { success: false, error: error?.message || String(error), mode: "session-toolset-preview-only", gateway_server_enabled: false, per_session_tools_list_enabled: false, dynamic_import_enabled: false, plugin_execution_enabled: false, list_changed_enabled: false };
  }
}

const sessionToolsetStatusTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Session toolset status",
    description: "Read-only preview status for future per-session TEST MCP toolsets and gateway readiness. Does not mutate tools/list or execute plug-ins.",
    inputSchema: EMPTY_INPUT_SCHEMA,
    outputSchema: GENERIC_SESSION_TOOLSET_OUTPUT_SCHEMA,
    annotations: READ_ONLY_SESSION_TOOLSET_ANNOTATIONS,
  },
  execute,
  summarizeArgs() { return { operation: "session_toolset_status" }; },
  resultStats(payload = {}) { return { result_count: payload.current_global_tool_surface_count || 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { sessionToolsetStatusTool };
