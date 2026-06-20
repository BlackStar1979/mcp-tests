"use strict";

const {
  AUTH_TRANSITION_STATUS_OUTPUT_SCHEMA,
  EMPTY_AUTH_INPUT_SCHEMA,
  READ_ONLY_AUTH_ANNOTATIONS,
} = require("../src/schemas/auth_tools");
const { getAuthTransitionStatus } = require("../src/auth_transition");

const TOOL_NAME = "auth_transition_status";

async function execute() {
  return getAuthTransitionStatus();
}

const authTransitionStatusTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Auth transition status",
    description: "Read-only status for TEST MCP auth.none exit readiness. Does not write secrets, change auth mode, or modify connector configuration.",
    inputSchema: EMPTY_AUTH_INPUT_SCHEMA,
    outputSchema: AUTH_TRANSITION_STATUS_OUTPUT_SCHEMA,
    annotations: READ_ONLY_AUTH_ANNOTATIONS,
  },
  execute,
  summarizeArgs() { return {}; },
  resultStats(payload = {}) { return { result_count: payload.success ? 1 : 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { authTransitionStatusTool };
