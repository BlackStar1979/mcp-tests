"use strict";

const {
  AUTH_MODULAR_PARITY_STATUS_OUTPUT_SCHEMA,
  EMPTY_AUTH_INPUT_SCHEMA,
  READ_ONLY_AUTH_ANNOTATIONS,
} = require("../src/schemas/auth_tools");
const { getModularAuthParityStatus } = require("../src/auth_modular_parity");

const TOOL_NAME = "auth_modular_parity_status";

async function execute() {
  return getModularAuthParityStatus();
}

const authModularParityStatusTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Modular MCP auth parity status",
    description: "Read-only TEST MCP status for Modular MCP auth parity: Cloudflare access assertion, Authorization bearer header, and query-token bearer delivery. Does not change auth mode or handle secrets.",
    inputSchema: EMPTY_AUTH_INPUT_SCHEMA,
    outputSchema: AUTH_MODULAR_PARITY_STATUS_OUTPUT_SCHEMA,
    annotations: READ_ONLY_AUTH_ANNOTATIONS,
  },
  execute,
  summarizeArgs() { return {}; },
  resultStats(payload = {}) { return { result_count: payload.success ? 1 : 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { authModularParityStatusTool };
