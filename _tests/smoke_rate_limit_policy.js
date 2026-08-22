const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createMemoryRateLimitStore, createJsonFileRateLimitStore, createSlidingWindowLimiter } = require("../src/runtime/rate_limit_state");
const { classifyTool, createRuntimeRateLimiter } = require("../src/runtime/rate_limit_policy");

let now = 1000;
const limiter = createSlidingWindowLimiter({ store: createMemoryRateLimitStore(), clock: () => now });
assert.equal(limiter.checkAndRecord({ key: "a", limit: 2, windowMs: 1000 }).allow, true);
assert.equal(limiter.checkAndRecord({ key: "a", limit: 2, windowMs: 1000 }).allow, true);
const denied = limiter.checkAndRecord({ key: "a", limit: 2, windowMs: 1000 });
assert.equal(denied.allow, false);
assert.equal(denied.retry_after_ms, 1000);
now = 2101;
assert.equal(limiter.checkAndRecord({ key: "a", limit: 2, windowMs: 1000 }).allow, true);

assert.equal(classifyTool("net_fetch_text_allowlisted"), "network");
assert.equal(classifyTool("dev_code_symbols"), "process_or_dev");
assert.equal(classifyTool("memory_search"), "memory");
assert.equal(classifyTool("search"), "default");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-rate-"));
const stateFile = path.join(tmp, "state.json");
const fileStore = createJsonFileRateLimitStore(stateFile);
const fileLimiter = createSlidingWindowLimiter({ store: fileStore, clock: () => 5000 });
assert.equal(fileLimiter.checkAndRecord({ key: "restart:file:42", limit: 1, windowMs: 10000 }).allow, true);
assert.equal(fileLimiter.checkAndRecord({ key: "restart:file:42", limit: 1, windowMs: 10000 }).allow, false);
assert.ok(fs.existsSync(stateFile));
assert.doesNotThrow(() => JSON.parse(fs.readFileSync(stateFile, "utf8")));

const renameFallbackStateFile = path.join(tmp, "rename-fallback-state.json");
const originalRenameSync = fs.renameSync;
fs.renameSync = (fromPath, toPath) => {
  if (String(toPath) === renameFallbackStateFile) {
    const error = new Error("rename blocked");
    error.code = "EPERM";
    throw error;
  }
  return originalRenameSync(fromPath, toPath);
};
try {
  const renameFallbackLimiter = createSlidingWindowLimiter({
    store: createJsonFileRateLimitStore(renameFallbackStateFile),
    clock: () => 5500,
  });
  assert.equal(renameFallbackLimiter.checkAndRecord({ key: "restart:file:rename-fallback", limit: 1, windowMs: 10000 }).allow, true);
  assert.ok(fs.existsSync(renameFallbackStateFile));
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(renameFallbackStateFile, "utf8")));
} finally {
  fs.renameSync = originalRenameSync;
}

const corruptStateFile = path.join(tmp, "corrupt-state.json");
fs.writeFileSync(corruptStateFile, "{not-json");
const corruptLimiter = createSlidingWindowLimiter({
  store: createJsonFileRateLimitStore(corruptStateFile),
  clock: () => 6000,
});
const corruptDecision = corruptLimiter.checkAndRecord({ key: "restart:file:43", limit: 1, windowMs: 10000 });
assert.equal(corruptDecision.allow, false);
assert.equal(corruptDecision.reason, "state_store_error");
assert.equal(corruptDecision.error_code, "rate_limit_state_read_failed");

const runtimeLimiter = createRuntimeRateLimiter({
  rootDir: tmp,
  env: {
    MCP_TEST_RATE_LIMIT_TOOL_MAX: "10",
    MCP_TEST_RATE_LIMIT_NETWORK_MAX: "1",
    MCP_TEST_RATE_LIMIT_PROCESS_MAX: "2",
    MCP_TEST_RATE_LIMIT_TOOL_WINDOW_MS: "60000",
    MCP_TEST_RATE_LIMIT_RESTART_MAX: "1",
    MCP_TEST_RATE_LIMIT_RESTART_WINDOW_MS: "60000",
    MCP_TEST_RATE_LIMIT_STATE_FILE: path.join(tmp, "runtime-state.json"),
  },
  clock: () => 10000,
});
const clientAFirst = runtimeLimiter.evaluateToolCall({ toolName: "search", profile: "internal", authMode: "oauth21", clientId: "client-a" });
const clientBFirst = runtimeLimiter.evaluateToolCall({ toolName: "search", profile: "internal", authMode: "oauth21", clientId: "client-b" });
assert.equal(clientAFirst.allow, true);
assert.equal(clientBFirst.allow, true);
assert.notEqual(clientAFirst.key, clientBFirst.key);
assert.equal(clientAFirst.key.includes("client-a"), false);
assert.equal(clientBFirst.key.includes("client-b"), false);
assert.equal(runtimeLimiter.evaluateToolCall({ toolName: "net_fetch_text_allowlisted", profile: "internal", authMode: "oauth21", clientId: "client-a" }).allow, true);
assert.equal(runtimeLimiter.evaluateToolCall({ toolName: "net_fetch_text_allowlisted", profile: "internal", authMode: "oauth21", clientId: "client-a" }).allow, false);
assert.equal(runtimeLimiter.evaluateToolCall({ toolName: "run_process", profile: "internal", authMode: "oauth21", clientId: "client-a" }).allow, true);
assert.equal(runtimeLimiter.evaluateToolCall({ toolName: "run_process", profile: "internal", authMode: "oauth21", clientId: "client-a" }).allow, true);
assert.equal(runtimeLimiter.evaluateToolCall({ toolName: "run_process", profile: "internal", authMode: "oauth21", clientId: "client-a" }).allow, false);
const status = runtimeLimiter.status();
assert.equal(status.network_max, 1);
assert.equal(status.process_max, 2);
assert.equal(runtimeLimiter.evaluateRestart({ code: 42, source: "file_trigger" }).allow, true);
assert.equal(runtimeLimiter.evaluateRestart({ code: 42, source: "file_trigger" }).allow, false);
console.log("smoke_rate_limit_policy ok");