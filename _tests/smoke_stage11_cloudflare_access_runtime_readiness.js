"use strict";

const assert = require("node:assert/strict");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ACCESS_ASSERTION_HEADER = "cf-access-jwt-assertion";
const ASSERTION = "test-access-assertion";
const EXPECTED_COMBINED_FINGERPRINT = "fb2cede646129d47";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitHealth(port) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return response.json();
    } catch {}
    await wait(100);
  }
  throw new Error("health timeout");
}

async function options(port) {
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "OPTIONS",
    headers: {
      "access-control-request-method": "POST",
      "access-control-request-headers": ACCESS_ASSERTION_HEADER,
    },
  });
  return {
    status: response.status,
    allowHeaders: response.headers.get("access-control-allow-headers") || "",
  };
}

async function rpc({ port, headers = {}, method = "tools/list", params = {} }) {
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: `${method}-${Date.now()}`, method, params }),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

async function callTool({ port, headers = {}, name, args = {} }) {
  const response = await rpc({
    port,
    headers,
    method: "tools/call",
    params: { name, arguments: args },
  });
  assert.equal(response.status, 200);
  const text = response.body.result?.content?.[0]?.text || "";
  assert.ok(text);
  return JSON.parse(text);
}

function assertUnauthorized(response) {
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, -32001);
  assert.equal(response.body.error.message, "Unauthorized");
  assert.equal(response.body.error.data.auth_mode, "access");
  assert.equal(response.body.error.data.auth_error, "missing_access_assertion");
}

function assertDoesNotContainAssertion(value) {
  assert.equal(String(value).includes(ASSERTION), false);
}

(async () => {
  const port = await getFreePort();
  const child = spawn(process.execPath, ["server.js", "--profile", "tests", "--auth", "access", "--port", String(port)], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      MCP_TEST_FS_ROOT: path.join(__dirname, "..", "_public_sandbox"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (data) => { output += String(data); });
  child.stderr.on("data", (data) => { output += String(data); });

  try {
    const health = await waitHealth(port);
    assert.equal(health.version, "0.30.0");
    assert.equal(health.auth.mode, "access");
    assert.equal(health.auth.requires_auth, true);
    assert.equal(health.auth.public_health_redacted, true);
    assert.equal(health.auth.public_health_auth_status_version, "public-health-auth-status-v1");
    assert.equal(Object.prototype.hasOwnProperty.call(health.auth, "validates_cloudflare_jwt"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(health.auth, "expects_cloudflare_proxy"), false);
    assertDoesNotContainAssertion(JSON.stringify(health));

    const preflight = await options(port);
    assert.equal(preflight.status, 204);
    assert.match(preflight.allowHeaders.toLowerCase(), /cf-access-jwt-assertion/);

    const missing = await rpc({ port });
    assertUnauthorized(missing);

    const empty = await rpc({ port, headers: { [ACCESS_ASSERTION_HEADER]: "" } });
    assertUnauthorized(empty);

    const valid = await rpc({ port, headers: { [ACCESS_ASSERTION_HEADER]: ASSERTION } });
    assert.equal(valid.status, 200);
    assert.ok(Array.isArray(valid.body.result.tools));
    assert.equal(valid.body.result.tools.length, 46);
    assertDoesNotContainAssertion(JSON.stringify(valid.body));

    const runtime = await callTool({
      port,
      headers: { [ACCESS_ASSERTION_HEADER]: ASSERTION },
      name: "test_mcp_runtime_status",
      args: { include_tools: true },
    });
    assert.equal(runtime.auth.mode, "access");
    assert.equal(runtime.auth.requires_auth, true);
    assert.equal(runtime.auth.validates_cloudflare_jwt, false);
    assert.equal(runtime.enabled_tools.length, 46);
    assert.equal(runtime.tool_surface.combined_fingerprint, EXPECTED_COMBINED_FINGERPRINT);
    assertDoesNotContainAssertion(JSON.stringify(runtime));
    assertDoesNotContainAssertion(output);

    console.log("smoke_stage11_cloudflare_access_runtime_readiness ok");
  } finally {
    child.kill();
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
