"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
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
  return registered.body.client_id;
}

async function issueToken(issuer, clientId, operatorSecret) {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const authorizeUrl = new URL(`${issuer}/authorize`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", "http://localhost/cb");
  authorizeUrl.searchParams.set("code_challenge", sha256Base64Url(verifier));
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("state", "revocation-binding");
  authorizeUrl.searchParams.set("scope", "mcp:tools");
  authorizeUrl.searchParams.set("resource", issuer);

  const authorize = await fetch(authorizeUrl, { redirect: "manual" });
  assert.equal(authorize.status, 302);
  const pid = new URL(authorize.headers.get("location")).searchParams.get("pid");

  const approved = await fetch(`${issuer}/oauth/operator-login`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      pid,
      client_id: clientId,
      redirect_uri: "http://localhost/cb",
      scope: "mcp:tools",
      password: operatorSecret,
    }),
    redirect: "manual",
  });
  assert.equal(approved.status, 302);
  const code = new URL(approved.headers.get("location")).searchParams.get("code");

  const token = await json(`${issuer}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: "http://localhost/cb",
      client_id: clientId,
      code_verifier: verifier,
      resource: issuer,
    }),
  });
  assert.equal(token.status, 200);
  return token.body;
}

async function toolsListStatus(issuer, accessToken) {
  const response = await fetch(`${issuer}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  return response.status;
}

(async () => {
  const port = await freePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-oauth21-revocation-binding-"));
  const secretFile = path.join(tempDir, "oauth.json");
  const clientsFile = path.join(tempDir, "clients.json");
  const operatorSecret = "stage12-oauth21-revocation-binding-secret";
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
    await waitHealth(port);
    const metadata = await json(`${issuer}/.well-known/oauth-authorization-server`);
    assert.equal(metadata.status, 200);
    assert.deepEqual(metadata.body.revocation_endpoint_auth_methods_supported, ["none"]);

    const clientA = await registerClient(issuer);
    const clientB = await registerClient(issuer);
    const token = await issueToken(issuer, clientA, operatorSecret);
    assert.equal(await toolsListStatus(issuer, token.access_token), 200);

    const missingClient = await json(`${issuer}/revoke`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: token.access_token }),
    });
    assert.equal(missingClient.status, 400);
    assert.deepEqual(missingClient.body, { error: "invalid_client" });
    assert.equal(await toolsListStatus(issuer, token.access_token), 200);

    const wrongClient = await json(`${issuer}/revoke`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: token.access_token, client_id: clientB }),
    });
    assert.equal(wrongClient.status, 200);
    assert.deepEqual(wrongClient.body, {});
    assert.equal(await toolsListStatus(issuer, token.access_token), 200);

    const correctClient = await json(`${issuer}/revoke`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: token.access_token, client_id: clientA }),
    });
    assert.equal(correctClient.status, 200);
    assert.deepEqual(correctClient.body, {});
    assert.equal(await toolsListStatus(issuer, token.access_token), 401);

    const rotated = await issueToken(issuer, clientA, operatorSecret);
    const refreshed = await json(`${issuer}/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientA,
        refresh_token: rotated.refresh_token,
        resource: issuer,
      }),
    });
    assert.equal(refreshed.status, 200);
    assert.equal(await toolsListStatus(issuer, rotated.access_token), 200);
    assert.equal(await toolsListStatus(issuer, refreshed.body.access_token), 200);

    const revokeRefresh = await json(`${issuer}/revoke`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshed.body.refresh_token, client_id: clientA }),
    });
    assert.equal(revokeRefresh.status, 200);
    assert.deepEqual(revokeRefresh.body, {});
    assert.equal(await toolsListStatus(issuer, rotated.access_token), 401);
    assert.equal(await toolsListStatus(issuer, refreshed.body.access_token), 401);

    const revokedRefreshUse = await json(`${issuer}/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientA,
        refresh_token: refreshed.body.refresh_token,
        resource: issuer,
      }),
    });
    assert.equal(revokedRefreshUse.status, 400);
    assert.deepEqual(revokedRefreshUse.body, { error: "invalid_grant" });

    console.log("smoke_oauth21_revocation_binding ok");
  } finally {
    child.kill();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
