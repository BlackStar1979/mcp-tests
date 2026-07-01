"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { validateRpcMessage } = require("../src/runtime/rpc_protocol_validator");
const { validateToolInput } = require("../src/runtime/tool_input_validator");
const { createAccessAuth } = require("../src/auth/auth_access");
const { createBearerAuth, extractBearerToken } = require("../src/auth/auth_bearer");
const { rotateAuditLogIfNeeded } = require("../src/runtime/audit_log");
const { assertPublicFsRootSafe } = require("../src/util/path_policy");
const { resolveAuthBootstrapConfig } = require("../src/runtime/auth_bootstrap_config_resolver");

(function protocolGate() {
  assert.equal(validateRpcMessage({ jsonrpc: "2.0", id: 1, method: "ping", params: {} }).ok, true);
  assert.equal(validateRpcMessage({ id: 1, method: "ping", params: {} }).reason, "jsonrpc_must_be_2_0");
  assert.equal(validateRpcMessage({ jsonrpc: "2.0", id: 1, method: "ping", params: [] }).code, -32602);
})();

(function inputSchemaGate() {
  const schema = { type: "object", additionalProperties: false, required: ["query"], properties: { query: { type: "string", minLength: 1 } } };
  assert.equal(validateToolInput("search", { query: "ok" }, schema).ok, true);
  const extra = validateToolInput("search", { query: "ok", secret_token: "blocked" }, schema);
  assert.equal(extra.ok, false);
  assert.ok(extra.errors.some((item) => item.includes("not allowed")));
})();

(function accessTrustedProxyGate() {
  const previous = process.env.MCP_TEST_ACCESS_TRUSTED_PROXY;
  try {
    delete process.env.MCP_TEST_ACCESS_TRUSTED_PROXY;
    assert.throws(() => createAccessAuth(), /TRUSTED_PROXY=1/);
    const policy = createAccessAuth({ trustedProxy: true });
    assert.equal(policy.authenticate({ headers: { "cf-access-jwt-assertion": "ok" } }).ok, true);
  } finally {
    if (previous === undefined) delete process.env.MCP_TEST_ACCESS_TRUSTED_PROXY;
    else process.env.MCP_TEST_ACCESS_TRUSTED_PROXY = previous;
  }
})();

(function bearerQueryTokenDisabledByDefault() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-hardening-bearer-"));
  const tokenFile = path.join(tempDir, "token.txt");
  const token = "hardening-bearer-token-0123456789abcdef";
  fs.writeFileSync(tokenFile, token, "utf8");
  try {
    const policy = createBearerAuth({ tokenFile });
    assert.equal(policy.status().accepts_query_token, false);
    assert.equal(extractBearerToken({ headers: {}, url: `/mcp?token=${encodeURIComponent(token)}` }), "");
    assert.equal(policy.authenticate({ headers: {}, url: `/mcp?token=${encodeURIComponent(token)}` }).error, "missing_bearer_token");
    assert.equal(policy.authenticate({ headers: { authorization: `Bearer ${token}` }, url: "/mcp" }).ok, true);
  } finally {
    try { fs.unlinkSync(tokenFile); } catch (_) {}
    try { fs.rmdirSync(tempDir); } catch (_) {}
  }
})();

(function auditRotationGuard() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-hardening-audit-"));
  const logPath = path.join(tempDir, "audit.jsonl");
  fs.writeFileSync(logPath, "x".repeat(128 * 1024), "utf8");
  const result = rotateAuditLogIfNeeded(logPath, 64 * 1024);
  assert.equal(result.rotated, true);
  assert.equal(fs.existsSync(logPath), true);
  assert.equal(fs.readFileSync(logPath, "utf8"), "");
  try { fs.unlinkSync(logPath); } catch (_) {}
  if (result.rotatedPath) try { fs.unlinkSync(result.rotatedPath); } catch (_) {}
  try { fs.rmdirSync(tempDir); } catch (_) {}
})();

(function publicFsRootGuard() {
  assert.throws(() => assertPublicFsRootSafe(path.join(__dirname, "..")), /Unsafe public FS root/);
})();

(function publicBindGuard() {
  assert.throws(() => resolveAuthBootstrapConfig({ env: { MCP_TEST_AUTH_MODE: "none", MCP_TEST_HOST: "0.0.0.0" }, argv: [] }), /Refusing to bind/);
  const allowed = resolveAuthBootstrapConfig({ env: { MCP_TEST_AUTH_MODE: "none", MCP_TEST_HOST: "0.0.0.0", MCP_TEST_ALLOW_PUBLIC_BIND: "1" }, argv: [] });
  assert.equal(allowed.host, "0.0.0.0");
})();

console.log("smoke_pre_oauth_hardening_guards ok");
