"use strict";

const {
  AUTH_BEARER_DRY_RUN_OUTPUT_SCHEMA,
  EMPTY_AUTH_INPUT_SCHEMA,
  READ_ONLY_AUTH_ANNOTATIONS,
} = require("../src/schemas/auth_tools");
const { runBearerDryRun } = require("../src/auth_bearer_dry_run");

const TOOL_NAME = "auth_bearer_dry_run";

async function execute() {
  return runBearerDryRun();
}

const authBearerDryRunTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Bearer auth dry-run",
    description: "Read-only TEST MCP bearer-auth dry-run. Uses a temporary synthetic token file outside the repo, verifies 401/200 behavior, and does not change active auth mode or connector config.",
    inputSchema: EMPTY_AUTH_INPUT_SCHEMA,
    outputSchema: AUTH_BEARER_DRY_RUN_OUTPUT_SCHEMA,
    annotations: READ_ONLY_AUTH_ANNOTATIONS,
  },
  execute,
  summarizeArgs() { return {}; },
  resultStats(payload = {}) { return { result_count: payload.success ? 1 : 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { authBearerDryRunTool };
