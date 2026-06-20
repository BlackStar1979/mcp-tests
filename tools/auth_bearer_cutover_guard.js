"use strict";

const {
  AUTH_BEARER_CUTOVER_GUARD_OUTPUT_SCHEMA,
  EMPTY_AUTH_INPUT_SCHEMA,
  READ_ONLY_AUTH_ANNOTATIONS,
} = require("../src/schemas/auth_tools");
const { getBearerCutoverGuard } = require("../src/auth_bearer_cutover_guard");

const TOOL_NAME = "auth_bearer_cutover_guard";

async function execute() {
  return getBearerCutoverGuard();
}

const authBearerCutoverGuardTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Bearer cutover guard",
    description: "Read-only guarded plan for a future TEST MCP switch from auth.none to bearer. Does not change auth mode, write secrets, or configure the connector.",
    inputSchema: EMPTY_AUTH_INPUT_SCHEMA,
    outputSchema: AUTH_BEARER_CUTOVER_GUARD_OUTPUT_SCHEMA,
    annotations: READ_ONLY_AUTH_ANNOTATIONS,
  },
  execute,
  summarizeArgs() { return {}; },
  resultStats(payload = {}) { return { result_count: payload.cutover_allowed_now ? 1 : 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { authBearerCutoverGuardTool };
