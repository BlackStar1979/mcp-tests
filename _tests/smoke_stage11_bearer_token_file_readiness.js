"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const TOKEN = "stage11-bearer-token-file-readiness-0123456789abcdef";
const WRONG_TOKEN = "stage11-bearer-token-file-wrong-0123456789abcdef";
const EXPECTED_COMBINED_FINGERPRINT = "fb2cede646129d47";
const FORBIDDEN_PUBLIC_HEALTH_AUTH_KEYS = [
  "token" + "_loaded",
  "token" + "_length",
  "token" + "_sha256" + "_prefix",
];

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

async function rpc({ port, token, headers = {}, method = "tools/list", params = {} }) {
  const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
  const response = await fetch(`http://127.0.0.1:${port}/mcp${suffix}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: `${method}-${Date.now()}`, method, params }),
  });

  return {
    status: response.status,
    challenge: response.headers.get("www-authenticate") || "",
    body: await response.json(),
  };
}

async function callTool({ port, headers = {}, token, name, args = {} }) {
  const response = await rpc({
    port,
    token,
    headers,
    method: "tools/call",
    params: { name, arguments: args },
  });
  assert.equal(response.status, 200);
  const text = response.body.result?.content?.[0]?.text || "";
  assert.ok(text);
  return JSON.parse(text);
}

function assertUnauthorized(response, expectedAuthError) {
  assert.equal(response.status, 401);
  assert.equal(response.challenge, 'Bearer realm="mcp-tests"');
  assert.equal(response.body.error.code, -32001);
  assert.equal(response.body.error.message, "Unauthorized");
  assert.equal(response.body.error.data.auth_mode, "bearer");
  assert.equal(response.body.error.data.auth_error, expectedAuthError);
}

function assertDoesNotContainToken(value) {
  assert.equal(String(value).includes(TOKEN), false);
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-stage11-bearer-"));
  const tokenFile = path.join(tmp, "token.txt");
  const port = await getFreePort();
  fs.writeFileSync(tokenFile, TOKEN, { encoding: "utf8", mode: 0o600 });

  const child = spawn(process.execPath, ["server.js", "--profile", "tests", "--auth", "bearer", "--token-file", tokenFile, "--port", String(port)], {
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
    assert.equal(health.auth.mode, "bearer");
    assert.equal(health.auth.requires_auth, true);
    assert.equal(health.auth.public_health_redacted, true);
    assert.equal(health.auth.public_health_auth_status_version, "public-health-auth-status-v1");
    for (const key of FORBIDDEN_PUBLIC_HEALTH_AUTH_KEYS) {
      assert.equal(Object.prototype.hasOwnProperty.call(health.auth, key), false);
    }
    assertDoesNotContainToken(JSON.stringify(health));

    const missing = await rpc({ port });
    assertUnauthorized(missing, "missing_bearer_token");

    const invalidHeader = await rpc({
      port,
      headers: { authorization: `Bearer ${WRONG_TOKEN}` },
    });
    assertUnauthorized(invalidHeader, "invalid_bearer_token");

    const validHeader = await rpc({
      port,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    assert.equal(validHeader.status, 200);
    assert.ok(Array.isArray(validHeader.body.result.tools));
    assert.equal(validHeader.body.result.tools.length, 46);
    assertDoesNotContainToken(JSON.stringify(validHeader.body));

    const validQuery = await rpc({ port, token: TOKEN });
    assert.equal(validQuery.status, 200);
    assert.ok(Array.isArray(validQuery.body.result.tools));
    assert.equal(validQuery.body.result.tools.length, 46);
    assertDoesNotContainToken(JSON.stringify(validQuery.body));

    const invalidQuery = await rpc({ port, token: WRONG_TOKEN });
    assertUnauthorized(invalidQuery, "invalid_bearer_token");

    const runtime = await callTool({
      port,
      headers: { authorization: `Bearer ${TOKEN}` },
      name: "test_mcp_runtime_status",
      args: { include_tools: true },
    });
    assert.equal(runtime.auth.mode, "bearer");
    assert.equal(runtime.auth.requires_auth, true);
    assert.equal(runtime.enabled_tools.length, 46);
    assert.equal(runtime.tool_surface.combined_fingerprint, EXPECTED_COMBINED_FINGERPRINT);
    assertDoesNotContainToken(JSON.stringify(runtime));
    assertDoesNotContainToken(output);

    console.log("smoke_stage11_bearer_token_file_readiness ok");
  } finally {
    child.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
