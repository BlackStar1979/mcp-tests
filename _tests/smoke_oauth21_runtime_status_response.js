"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { RUNTIME_STATUS_OUTPUT_SCHEMA } = require("../src/schemas/runtime_status");
const { assertMatchesSchema } = require("../src/output_schema_guard");
const { sha256Base64Url } = require("../src/auth/oauth21_authorization_server");

const ROOT = path.join(__dirname, "..");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function cleanEnv(overrides = {}) {
  const env = { ...process.env };
  for (const key of [
    "MCP_TEST_AUTH_MODE",
    "MCP_TEST_PORT",
    "MCP_TEST_OAUTH_OPERATOR_SECRET",
    "MCP_TEST_OAUTH_ISSUER",
    "MCP_TEST_PUBLIC_BASE_URL",
  ]) {
    delete env[key];
  }
  return { ...env, ...overrides };
}

async function waitHealth(port) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return response.json();
    } catch (_) {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("health timeout");
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { status: response.status, headers: response.headers, body };
}

async function getOauthToken(issuer, operatorSecret) {
  const registered = await json(`${issuer}/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      redirect_uris: ["http://localhost/cb"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });
  assert.equal(registered.status, 201);
  assert.ok(registered.body.client_id);

  const verifier = crypto.randomBytes(32).toString("base64url");
  const authorizeUrl = new URL(`${issuer}/authorize`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", registered.body.client_id);
  authorizeUrl.searchParams.set("redirect_uri", "http://localhost/cb");
  authorizeUrl.searchParams.set("code_challenge", sha256Base64Url(verifier));
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("state", "runtime-status");
  authorizeUrl.searchParams.set("scope", "mcp:tools");

  const authorize = await fetch(authorizeUrl, { redirect: "manual" });
  assert.equal(authorize.status, 302);
  const login = authorize.headers.get("location");
  assert.ok(login && login.includes("/oauth/operator-login?pid="));

  const pid = new URL(login).searchParams.get("pid");
  const approved = await fetch(`${issuer}/oauth/operator-login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ pid, password: operatorSecret }),
    redirect: "manual",
  });
  assert.equal(approved.status, 302);

  const callback = new URL(approved.headers.get("location"));
  const code = callback.searchParams.get("code");
  assert.ok(code);

  const token = await json(`${issuer}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: "http://localhost/cb",
      client_id: registered.body.client_id,
      code_verifier: verifier,
    }),
  });
  assert.equal(token.status, 200);
  assert.ok(token.body.access_token);
  return token.body.access_token;
}

async function rpc(issuer, token, id, args) {
  return rpcMessage(issuer, token, {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      name: "test_mcp_runtime_status",
      arguments: args,
    },
  });
}

async function rpcMessage(issuer, token, message) {
  return json(`${issuer}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(message),
  });
}

function assertRuntimeStatusResponse(response, expectedToolsIncluded) {
  assert.equal(response.status, 200);
  assert.equal(response.body.jsonrpc, "2.0");
  assert.ok(response.body.result);
  assert.ok(response.body.result.structuredContent);
  const structured = response.body.result.structuredContent;
  assert.equal(structured.auth.mode, "oauth21");
  assert.equal(structured.auth.enabled, true);
  assert.equal(structured.auth.requires_auth, true);
  assert.equal(structured.auth.token_file_configured, false);
  assert.equal(structured.auth.token_loaded, false);
  assert.equal(structured.auth.token_length, 0);
  assert.equal(structured.auth.token_sha256_prefix, "");
  assert.equal(Object.prototype.hasOwnProperty.call(structured.auth, "token_validation_mode"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(structured.auth, "issuer"), false);
  assert.equal(Array.isArray(structured.enabled_tools), true);
  assert.equal(structured.enabled_tools.length > 0, expectedToolsIncluded);
  assert.doesNotThrow(() => JSON.stringify(response.body));
  assert.doesNotThrow(() => assertMatchesSchema(structured, RUNTIME_STATUS_OUTPUT_SCHEMA, "oauth21 runtime status"));
}

function assertOauth21ToolsListPermissions(response) {
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.result?.tools));
  assert.equal(response.body.result.tools.length > 0, true);
  for (const tool of response.body.result.tools) {
    assert.deepEqual(tool.securitySchemes, [{ type: "oauth2", scopes: ["mcp:tools"] }], tool.name);
    assert.deepEqual(tool._meta?.securitySchemes, tool.securitySchemes, tool.name);
  }
}

(async () => {
  const port = await freePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-oauth21-runtime-status-"));
  const secretFile = path.join(tempDir, "oauth.json");
  const clientsFile = path.join(tempDir, "clients.json");
  const operatorSecret = "stage12-oauth21-runtime-status-operator-secret";
  const issuer = `http://127.0.0.1:${port}`;
  fs.writeFileSync(secretFile, JSON.stringify({ operator_secret: operatorSecret, issuer }), "utf8");

  const child = spawn(process.execPath, [
    "server.js",
    "--profile",
    "tests",
    "--auth",
    "oauth21",
    "--oauth-secret-file",
    secretFile,
    "--port",
    String(port),
  ], {
    cwd: ROOT,
    env: cleanEnv({
      MCP_TEST_FS_ROOT: path.join(ROOT, "_public_sandbox"),
      MCP_TEST_PUBLIC_BASE_URL: issuer,
      MCP_TEST_OAUTH_CLIENTS_FILE: clientsFile,
    }),
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    const health = await waitHealth(port);
    assert.equal(health.auth.mode, "oauth21");
    const protectedResource = await json(`${issuer}/.well-known/oauth-protected-resource`);
    assert.equal(protectedResource.status, 200);
    assert.deepEqual(protectedResource.body.scopes_supported, ["mcp:tools"]);
    const token = await getOauthToken(issuer, operatorSecret);
    assertOauth21ToolsListPermissions(await rpcMessage(issuer, token, { jsonrpc: "2.0", id: 3, method: "tools/list", params: {} }));
    assertRuntimeStatusResponse(await rpc(issuer, token, 1, { include_tools: false }), false);
    assertRuntimeStatusResponse(await rpc(issuer, token, 2, { include_tools: true }), true);
    console.log("smoke_oauth21_runtime_status_response ok");
  } finally {
    child.kill();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
