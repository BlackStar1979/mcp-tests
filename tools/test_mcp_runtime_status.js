const {
  RUNTIME_STATUS_INPUT_SCHEMA,
  RUNTIME_STATUS_OUTPUT_SCHEMA,
} = require("../src/schemas/runtime_status");

const READ_ONLY_LOCAL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const TOOL_NAME = "test_mcp_runtime_status";

function createTestMcpRuntimeStatusTool(getRuntimeStatus) {
  if (typeof getRuntimeStatus !== "function") {
    throw new Error("createTestMcpRuntimeStatusTool requires getRuntimeStatus function.");
  }

  return {
    name: TOOL_NAME,
    descriptor: {
      name: TOOL_NAME,
      title: "TEST MCP runtime status",
      description:
        "Read-only runtime governance snapshot for TEST MCP. Returns versions, enabled tools, auth mode, limits, and network policy without secrets.",
      inputSchema: RUNTIME_STATUS_INPUT_SCHEMA,
      outputSchema: RUNTIME_STATUS_OUTPUT_SCHEMA,
      annotations: READ_ONLY_LOCAL_ANNOTATIONS,
    },
    async execute(args = {}) {
      const status = getRuntimeStatus();
      if (args.include_tools === false) {
        status.enabled_tools = [];
        status.tool_policy_summary = [];
        if (status.tool_surface && typeof status.tool_surface === "object") {
          delete status.tool_surface.tool_names;
          delete status.tool_surface.per_tool;
        }
        if (status.schema_compatibility && typeof status.schema_compatibility === "object") {
          delete status.schema_compatibility.per_tool;
          delete status.schema_compatibility.issues;
        }
      }
      return status;
    },
    summarizeArgs() {
      return {
        arg_name: "none",
        arg_sha256: "",
        arg_length_chars: 0,
      };
    },
    resultStats(payload = {}) {
      return {
        result_count: Array.isArray(payload.enabled_tools) ? payload.enabled_tools.length : 0,
        result_chars: JSON.stringify(payload || {}).length,
      };
    },
  };
}

module.exports = {
  createTestMcpRuntimeStatusTool,
};
