const {
  GENERIC_OBSERVABILITY_OUTPUT_SCHEMA,
  OBSERVABILITY_STATUS_INPUT_SCHEMA,
  READ_ONLY_OBSERVABILITY_ANNOTATIONS,
} = require("../src/schemas/observability_tools");
const { buildObservabilityStatus } = require("../src/observability_status");
const { CURRENT_STAGE_STATUS } = require("../src/stage_metadata");

const TOOL_NAME = "observability_status";

function createObservabilityStatusTool(options = {}) {
  async function execute(args = {}) {
    try {
      return buildObservabilityStatus({
        args,
        runtimeStatusProvider: options.runtimeStatusProvider,
        auditLogPath: options.auditLogPath,
      });
    } catch (error) {
      return {
        success: false,
        error: error?.message || String(error),
        mode: "observability-status",
        observability_version: "test-mcp-observability-v1",
        stage: CURRENT_STAGE_STATUS,
        read_only: true,
        mutates_auth: false,
        mutates_tools_list: false,
        dynamic_import_enabled: false,
        list_changed_enabled: false,
        audit_log: { status: "error" },
        audit_jsonl_health: { status: "error" },
        runtime: { status: "unknown" },
        connector_map: { comparison_available: false, status: "unknown" },
        connector_map_health: { status: "unknown" },
        events: {},
        tool_call_balance: {},
        audit_semantics: {},
        transport_runtime_signals: {},
        path_redaction_risk: {},
        latency: {},
        slow_tool_summary: {},
        stream_break_diagnostics: {},
        child_process_anomalies: {},
        recommended_actions: ["Inspect observability_status error and audit-log availability."],
        next_recommended_checks: ["Inspect observability_status error and audit-log availability."],
      };
    }
  }

  return {
    name: TOOL_NAME,
    descriptor: {
      name: TOOL_NAME,
      title: "Observability status",
      description:
        "Read-only TEST MCP observability snapshot for audit-log latency, tool-call errors, stale connector-map comparison, stream-break indicators, and child-process anomaly readiness. Does not change auth, tools/list, connector config, plug-ins, or server state.",
      inputSchema: OBSERVABILITY_STATUS_INPUT_SCHEMA,
      outputSchema: GENERIC_OBSERVABILITY_OUTPUT_SCHEMA,
      annotations: READ_ONLY_OBSERVABILITY_ANNOTATIONS,
    },
    execute,
    summarizeArgs(args = {}) {
      return {
        operation: "observability_status",
        window_size: args.window_size || null,
        slow_ms: args.slow_ms || null,
        top_n: args.top_n || null,
        connector_visible_tool_count: Array.isArray(args.connector_visible_tools) ? args.connector_visible_tools.length : 0,
      };
    },
    resultStats(payload = {}) {
      return {
        result_count: payload?.latency?.per_tool?.length || 0,
        result_chars: JSON.stringify(payload || {}).length,
      };
    },
  };
}

module.exports = { createObservabilityStatusTool };
