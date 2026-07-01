const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const serverSource = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.resolve(__dirname, "..", "src", "runtime", "server_bootstrap_runtime.js"), "utf8");

assert.ok(bootstrapSource.includes('path.join(rootDir, "_logs")'), "default audit log directory must be mcp-tests/_logs");
assert.ok(bootstrapSource.includes('path.join(auditLogDir, ".mcp-tests-audit.jsonl")'), "default audit log file must be inside auditLogDir");
assert.ok(bootstrapSource.includes("env.MCP_TEST_AUDIT_LOG"), "explicit MCP_TEST_AUDIT_LOG override must remain supported");
assert.ok(bootstrapSource.includes("env.MCP_TEST_LOG_DIR"), "MCP_TEST_LOG_DIR override must be supported");
assert.ok(!serverSource.includes('path.join(__dirname, ".mcp-tests-audit.jsonl")'), "root-level default audit log path must not return");
assert.ok(serverSource.includes("C:\\Work\\mcp-tests\\_logs\\.mcp-tests-audit.jsonl"), "header comment must document _logs directory path");

console.log("smoke_runtime_log_directory ok");
