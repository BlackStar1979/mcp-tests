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
    // Without these, every spawned test server created ~/.romion/tests_{content_stages,file_compose}_<port>.sqlite:
    // 1574 stage files had piled up in the SECRET store by 2026-10-16, one set per dynamic port.
    MCP_CONTENT_STAGE_STORAGE_FILE: env.MCP_CONTENT_STAGE_STORAGE_FILE || path.join(root, "content-stages.sqlite"),
    MCP_FILE_COMPOSE_STORAGE_FILE: env.MCP_FILE_COMPOSE_STORAGE_FILE || path.join(root, "file-compose.sqlite"),
  };
}

module.exports = { withHermeticServerControlEnv };
