"use strict";

const path = require("node:path");

function withHermeticServerControlEnv(env = {}, tempRoot) {
  const root = path.resolve(String(tempRoot || ""));
  if (!tempRoot || root === path.parse(root).root) {
    throw new Error("hermetic server control tempRoot must be a bounded non-root path");
  }
  return {
    ...env,
    MCP_TEST_TOOL_SURFACE_STATE_FILE: path.join(root, "tool-surface-state.json"),
    MCP_TEST_RATE_LIMIT_STATE_FILE: path.join(root, "rate-limit-state.json"),
    MCP_TEST_AUDIT_LOG: env.MCP_TEST_AUDIT_LOG || path.join(root, "audit.jsonl"),
    MCP_TEST_ENABLE_RESTART_TRIGGER: "0",
    MCP_TEST_RESTART_TRIGGER_FILE: path.join(root, "restart-request.json"),
  };
}

module.exports = { withHermeticServerControlEnv };
