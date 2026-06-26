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

const runtimeLimiter = createRuntimeRateLimiter({
  rootDir: tmp,
  env: {
    MCP_TEST_RATE_LIMIT_TOOL_MAX: "1",
    MCP_TEST_RATE_LIMIT_TOOL_WINDOW_MS: "60000",
    MCP_TEST_RATE_LIMIT_RESTART_MAX: "1",
    MCP_TEST_RATE_LIMIT_RESTART_WINDOW_MS: "60000",
    MCP_TEST_RATE_LIMIT_STATE_FILE: path.join(tmp, "runtime-state.json"),
  },
  clock: () => 10000,
});
assert.equal(runtimeLimiter.evaluateToolCall({ toolName: "search", profile: "internal", authMode: "oauth21" }).allow, true);
assert.equal(runtimeLimiter.evaluateToolCall({ toolName: "search", profile: "internal", authMode: "oauth21" }).allow, false);
assert.equal(runtimeLimiter.evaluateRestart({ code: 42, source: "file_trigger" }).allow, true);
assert.equal(runtimeLimiter.evaluateRestart({ code: 42, source: "file_trigger" }).allow, false);
console.log("smoke_rate_limit_policy ok");
