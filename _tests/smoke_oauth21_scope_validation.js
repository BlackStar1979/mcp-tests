"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { sha256Base64Url } = require("../src/auth/oauth21_authorization_server");
const { withHermeticServerControlEnv } = require("./helpers/hermetic_server_control_env");

const ROOT = path.join(__dirname, "..");

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
}

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
      if (response.ok) return;
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
  return { status: response.status, body };
}

async function registerClient(issuer) {
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
  return registered.body.client_id;
}

function buildAuthorizeUrl({ issuer, clientId, scope }) {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const authorizeUrl = new URL(`${issuer}/authorize`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", "http://localhost/cb");
  authorizeUrl.searchParams.set("code_challenge", sha256Base64Url(verifier));
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("state", "scope-validation");
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("resource", issuer);
  return authorizeUrl;
}

(async () => {
  const port = await freePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-oauth21-scope-validation-"));
  const secretFile = path.join(tempDir, "oauth.json");
  const storageFile = path.join(tempDir, "oauth.sqlite");
  const issuer = `http://127.0.0.1:${port}`;
  fs.writeFileSync(secretFile, JSON.stringify({
    operator_secret: "stage12-oauth21-scope-validation-secret",
    issuer,
  }), "utf8");

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
    env: withHermeticServerControlEnv(cleanEnv({
      MCP_TEST_FS_ROOT: path.join(ROOT, "_public_sandbox"),
      MCP_TEST_PUBLIC_BASE_URL: issuer,
      MCP_TEST_OAUTH_STORAGE_FILE: storageFile,
    }), tempDir),
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitHealth(port);
    const clientId = await registerClient(issuer);

    const rejected = await fetch(buildAuthorizeUrl({ issuer, clientId, scope: "mcp:operator" }), {
      redirect: "manual",
    });
    assert.equal(rejected.status, 400);
    assert.deepEqual(await rejected.json(), {
      error: "invalid_scope",
      error_description: "unsupported_scope",
    });

    const accepted = await fetch(buildAuthorizeUrl({ issuer, clientId, scope: "mcp:tools" }), {
      redirect: "manual",
    });
    assert.equal(accepted.status, 302);
    assert.match(String(accepted.headers.get("location") || ""), /\/oauth\/operator-login\?pid=/);

    console.log("smoke_oauth21_scope_validation ok");
  } finally {
    await stopChild(child);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
