const assert = require("node:assert/strict");
const { handleToolsCall } = require("../src/runtime/tools_call_handler");
const { createRestartController } = require("../src/runtime/restart_controller");

(async () => {
  const audits = [];
  const deniedLimiter = {
    evaluateToolCall() {
      return { allow: false, kind: "tool_call", key: "tool:oauth21:internal:default:search", limit: 1, window_ms: 60000, retry_after_ms: 60000 };
    },
  };
  const response = await handleToolsCall({
    id: 7,
    params: { name: "search", arguments: { query: "x" } },
    context: { requestId: "quota-smoke" },
    outputMode: "structured",
    documentRuntimeContext: {},
    auditLog: (event, data) => audits.push({ event, data }),
    authMode: "oauth21",
    profile: "internal",
    getOptionalTool: () => null,
    rateLimiter: deniedLimiter,
  });
  assert.equal(response.error.code, -32029);
  assert.equal(response.error.data.decision_code, "rate_limit_exceeded");
  assert.ok(audits.some((x) => x.event === "tool_call_rate_limited"));

  const restartAudits = [];
  const restartController = createRestartController({
    env: {},
    auditLog: (event, data) => restartAudits.push({ event, data }),
    exit: () => { throw new Error("exit should not be called when limited"); },
    rateLimiter: { evaluateRestart: () => ({ allow: false, kind: "runtime_restart", retry_after_ms: 1000 }) },
  });
  const restart = restartController.requestRestart({ code: 42, reason: "smoke", source: "file_trigger", requestId: "restart-smoke" });
  assert.equal(restart.ok, false);
  assert.equal(restart.reason, "rate_limit_exceeded");
  assert.ok(restartAudits.some((x) => x.event === "runtime_restart_rate_limited"));
  console.log("smoke_quota_runtime_integration ok");
})();
