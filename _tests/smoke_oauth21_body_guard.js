"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { spawn } = require("node:child_process");
const { readJsonBody } = require("../src/auth/oauth21_utils");

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
  const env = { ...process.env, ...overrides };
  for (const key of ["MCP_TEST_AUTH_MODE", "MCP_TEST_PORT", "MCP_TEST_OAUTH_OPERATOR_SECRET", "MCP_TEST_OAUTH_ISSUER", "MCP_TEST_PUBLIC_BASE_URL"]) {
    delete env[key];
  }
  return { ...env, ...overrides };
}

async function waitHealth(port) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return response.json();
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("health timeout");
}

async function postMalformed(issuer, targetPath) {
  const response = await fetch(`${issuer}${targetPath}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(response.status, 400, targetPath);
  assert.ok((response.headers.get("content-type") || "").includes("application/json"), targetPath);
  const body = await response.json();
  assert.equal(body.error, "invalid_request", targetPath);
}

async function postWrongContentType(issuer, targetPath, contentType, bodyText) {
  const response = await fetch(`${issuer}${targetPath}`, {
    method: "POST",
    headers: { "content-type": contentType },
    body: bodyText,
  });
  assert.equal(response.status, 400, `${targetPath} ${contentType}`);
  assert.ok((response.headers.get("content-type") || "").includes("application/json"), targetPath);
  const body = await response.json();
  assert.equal(body.error, "invalid_request", `${targetPath} ${contentType}`);
}

async function postOversized(issuer, targetPath) {
  const hugePayload = JSON.stringify({
    redirect_uris: ["https://client.example/callback"],
    padding: "x".repeat(70_000),
  });
  try {
    const response = await fetch(`${issuer}${targetPath}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: hugePayload,
    });
    assert.equal(response.status, 400, `${targetPath} oversized`);
    const body = await response.json();
    assert.equal(body.error, "invalid_request");
  } catch (error) {
    assert.match(String(error?.message || error), /fetch failed/i);
  }
}

async function assertOversizedBodyDestroysRequest() {
  class FakeRequest extends EventEmitter {
    constructor() {
      super();
      this.headers = { "content-type": "application/json" };
      this.destroyed = false;
      this.destroyCalls = 0;
    }
    destroy(error) {
      this.destroyed = true;
      this.destroyCalls += 1;
      this.destroyError = error;
    }
  }

  const req = new FakeRequest();
  const bodyPromise = readJsonBody(req);
  req.emit("data", `{"padding":"${"x".repeat(70_000)}`);
  await assert.rejects(bodyPromise, /body_too_large/);
  assert.equal(req.destroyed, true);
  assert.equal(req.destroyCalls, 1);
}

(async () => {
  await assertOversizedBodyDestroysRequest();

  const port = await freePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-oauth21-body-"));
  const secretFile = path.join(tempDir, "oauth.json");
  const operatorSecret = "stage12-oauth21-operator-secret";
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
    }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });
  try {
    const health = await waitHealth(port);
    assert.equal(health.auth.mode, "oauth21");
    for (const route of ["/register", "/token", "/revoke", "/oauth/operator-login"]) {
      await postMalformed(issuer, route);
      const stillHealthy = await fetch(`${issuer}/healthz`);
      assert.equal(stillHealthy.status, 200, route);
    }
    await postWrongContentType(issuer, "/register", "application/x-www-form-urlencoded", "redirect_uris=http%3A%2F%2Flocalhost%2Fcb");
    await postWrongContentType(issuer, "/token", "application/json", JSON.stringify({ grant_type: "refresh_token" }));
    await postWrongContentType(issuer, "/revoke", "application/json", JSON.stringify({ token: "x", client_id: "y" }));
    await postWrongContentType(issuer, "/oauth/operator-login", "application/json", JSON.stringify({ pid: "x", password: "y" }));
    await postWrongContentType(issuer, "/register", "text/application/json", "{}");
    await postWrongContentType(issuer, "/token", "application/x-www-form-urlencodedevil", "grant_type=refresh_token");
    await postOversized(issuer, "/register");
    const stillHealthy = await fetch(`${issuer}/healthz`);
    assert.equal(stillHealthy.status, 200, "oversized body health");
    console.log("smoke_oauth21_body_guard ok");
  } catch (error) {
    error.message += output ? `\nserver output:\n${output}` : "";
    throw error;
  } finally {
    child.kill();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
