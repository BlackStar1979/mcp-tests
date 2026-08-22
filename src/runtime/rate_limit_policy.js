"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const { createJsonFileRateLimitStore, createMemoryRateLimitStore, createSlidingWindowLimiter } = require("./rate_limit_state");

function boolEnv(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function intEnv(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value === undefined || value === null || value === "" ? fallback : value);
  if (!Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}

function defaultRateLimitStateFile(rootDir) {
  return path.join(rootDir, "_control", "rate-limit-state.json");
}

function classifyTool(toolName) {
  const name = String(toolName || "unknown");
  if (name.startsWith("net_")) return "network";
  if (name.startsWith("dev_") || name.startsWith("code_") || name.includes("process")) return "process_or_dev";
  if (name.startsWith("memory_")) return "memory";
  return "default";
}

function hashRateLimitIdentity(value) {
  return crypto.createHash("sha256").update(String(value || "anonymous"), "utf8").digest("hex");
}

function limitForToolClass(toolClass, { toolMax, networkMax, processMax }) {
  if (toolClass === "network") return networkMax;
  if (toolClass === "process_or_dev") return processMax;
  return toolMax;
}

function createRuntimeRateLimiter({ env = process.env, rootDir = path.resolve(__dirname, "../.."), clock } = {}) {
  const enabled = boolEnv(env.MCP_TEST_RATE_LIMIT_ENABLED, true);
  const toolWindowMs = intEnv(env.MCP_TEST_RATE_LIMIT_TOOL_WINDOW_MS, 60000, 1000);
  const toolMax = intEnv(env.MCP_TEST_RATE_LIMIT_TOOL_MAX, 10000, 1);
  const networkMax = intEnv(env.MCP_TEST_RATE_LIMIT_NETWORK_MAX, Math.min(toolMax, 1000), 1);
  const processMax = intEnv(env.MCP_TEST_RATE_LIMIT_PROCESS_MAX, Math.min(toolMax, 100), 1);
  const restartWindowMs = intEnv(env.MCP_TEST_RATE_LIMIT_RESTART_WINDOW_MS, 600000, 1000);
  const restartMax = intEnv(env.MCP_TEST_RATE_LIMIT_RESTART_MAX, 3, 1);
  const toolLimiter = createSlidingWindowLimiter({ store: createMemoryRateLimitStore(), clock });
  const restartStateFile = String(env.MCP_TEST_RATE_LIMIT_STATE_FILE || defaultRateLimitStateFile(rootDir));
  const restartLimiter = createSlidingWindowLimiter({ store: createJsonFileRateLimitStore(restartStateFile), clock });

  function disabled(kind) { return { allow: true, disabled: true, kind, reason: "rate_limit_disabled" }; }

  function evaluateToolCall({ toolName, profile = "unknown", authMode = "unknown", clientId = "" } = {}) {
    const toolClass = classifyTool(toolName);
    if (!enabled) return disabled("tool_call");
    const clientKey = hashRateLimitIdentity(clientId || "anonymous");
    const limit = limitForToolClass(toolClass, { toolMax, networkMax, processMax });
    const key = ["tool", authMode || "unknown", profile || "unknown", clientKey, toolClass, toolName || "unknown"].join(":");
    const decision = toolLimiter.checkAndRecord({ key, limit, windowMs: toolWindowMs });
    return { ...decision, kind: "tool_call", tool: toolName || "unknown", tool_class: toolClass, client_key: clientKey };
  }

  function evaluateRestart({ code = 42, source = "runtime" } = {}) {
    if (!enabled) return disabled("runtime_restart");
    const key = ["restart", source || "runtime", String(code)].join(":");
    const decision = restartLimiter.checkAndRecord({ key, limit: restartMax, windowMs: restartWindowMs });
    return { ...decision, kind: "runtime_restart", source, code, state_file: restartStateFile };
  }

  function status() {
    return {
      enabled,
      tool_window_ms: toolWindowMs,
      tool_max: toolMax,
      network_max: networkMax,
      process_max: processMax,
      restart_window_ms: restartWindowMs,
      restart_max: restartMax,
      restart_state_file: restartStateFile,
    };
  }

  return { evaluateToolCall, evaluateRestart, status };
}

module.exports = { boolEnv, intEnv, classifyTool, createRuntimeRateLimiter, defaultRateLimitStateFile, hashRateLimitIdentity, limitForToolClass };
