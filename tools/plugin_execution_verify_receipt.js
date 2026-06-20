"use strict";

const {
  GENERIC_PLUGIN_EXECUTION_OUTPUT_SCHEMA,
  PLUGIN_EXECUTION_VERIFY_RECEIPT_INPUT_SCHEMA,
  READ_ONLY_PLUGIN_EXECUTION_ANNOTATIONS,
} = require("../src/schemas/plugin_execution_tools");
const { verifyExecutionReceipt } = require("../src/plugin_execution");

const TOOL_NAME = "plugin_execution_verify_receipt";

async function execute(args = {}) {
  try {
    return verifyExecutionReceipt(args);
  } catch (error) {
    return {
      success: false,
      error: error?.message || String(error),
      mode: "plugin-execution-receipt-verifier",
      receipt_valid: false,
      verifier_flags: {
        read_only: true,
        executes_plugin: false,
        dynamic_import_enabled: false,
        plugin_execution_allowed: false,
        real_tools_list_mutation_enabled: false,
        list_changed_enabled: false,
      },
    };
  }
}

const pluginExecutionVerifyReceiptTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Verify plugin execution receipt",
    description: "Read-only verifier for TEST MCP plug-in execution audit-envelope receipts. Does not execute plug-ins or mutate tools/list.",
    inputSchema: PLUGIN_EXECUTION_VERIFY_RECEIPT_INPUT_SCHEMA,
    outputSchema: GENERIC_PLUGIN_EXECUTION_OUTPUT_SCHEMA,
    annotations: READ_ONLY_PLUGIN_EXECUTION_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) {
    return {
      operation: String(args.operation || ""),
      tool_name: String(args.tool_name || ""),
      plugin_id: String(args.plugin_id || ""),
      execution_id: String(args.execution_id || ""),
    };
  },
  resultStats(payload = {}) {
    return { result_count: payload.receipt_valid ? 1 : 0, result_chars: JSON.stringify(payload || {}).length };
  },
};

module.exports = { pluginExecutionVerifyReceiptTool };
