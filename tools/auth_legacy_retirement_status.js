"use strict";

const {
  AUTH_LEGACY_RETIREMENT_STATUS_OUTPUT_SCHEMA,
  EMPTY_AUTH_INPUT_SCHEMA,
  READ_ONLY_AUTH_ANNOTATIONS,
} = require("../src/schemas/auth_tools");

const TOOL_NAME = "auth_legacy_retirement_status";
const VERSION = "auth-legacy-retirement-status-v1";

async function execute() {
  return {
    success: true,
    mode: "retired_access_bearer_runtime_status",
    version: VERSION,
    active_auth_modes: ["none", "oauth21"],
    active_ports: { none: 3009, oauth21: 3008 },
    retired_auth_modes: ["access", "bearer"],
    retired_ports: { access: 3005, bearer: 3006 },
    legacy_non_target_modes: ["oauth"],
    legacy_non_target_ports: { oauth: 3007 },
    legacy_tools_replaced: [
      "auth_transition_status",
      "auth_bearer_dry_run",
      "auth_bearer_cutover_guard",
      "auth_modular_parity_status",
    ],
    stage: "auth-legacy-retirement-status",
    connector_refresh_required: true,
    message: "access:3005 and bearer:3006 are retired from TEST MCP target runtime topology; use public auth none on 3009 and authorized oauth21 on 3008.",
  };
}

const authLegacyRetirementStatusTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Auth legacy retirement status",
    description: "Read-only status for retired TEST MCP access/bearer runtime targets. Does not change auth mode, write secrets, or modify connector configuration.",
    inputSchema: EMPTY_AUTH_INPUT_SCHEMA,
    outputSchema: AUTH_LEGACY_RETIREMENT_STATUS_OUTPUT_SCHEMA,
    annotations: READ_ONLY_AUTH_ANNOTATIONS,
  },
  execute,
  summarizeArgs() { return {}; },
  resultStats(payload = {}) { return { result_count: payload.success ? 1 : 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { authLegacyRetirementStatusTool };
