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
  const env = { ...process.env, ...overrides };
  for (const key of [
    "MCP_TEST_AUTH_MODE",
    "MCP_TEST_PORT",
    "MCP_TEST_OAUTH_OPERATOR_SECRET",
    "MCP_TEST_OAUTH_ISSUER",
    "MCP_TEST_OAUTH_AUDIENCE",
    "MCP_TEST_PUBLIC_BASE_URL",
  ]) {
    delete env[key];
  }
  return { ...env, ...overrides };
}

async function waitHealth(port) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return response.json();
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("health timeout");
}

async function json(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { status: response.status, headers: response.headers, body };
}

(async () => {
  const port = await freePort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-oauth21-"));
  const configFile = path.join(tmp, "oauth.json");
  const clientsFile = path.join(tmp, "clients.json");
  const stateFile = path.join(tmp, "state.json");
  const operatorSecret = "stage12-oauth21-operator-secret";
  const issuer = `http://127.0.0.1:${port}`;
  const resource = `${issuer}/mcp`;

  fs.writeFileSync(configFile, JSON.stringify({ operator_secret: operatorSecret, issuer }), "utf8");

  const child = spawn(
    process.execPath,
    ["server.js", "--profile", "tests", "--auth", "oauth21", "--oauth-secret-file", configFile, "--port", String(port)],
    {
      cwd: ROOT,
      env: cleanEnv({
        MCP_TEST_FS_ROOT: path.join(ROOT, "_public_sandbox"),
        MCP_TEST_PUBLIC_BASE_URL: issuer,
        MCP_TEST_OAUTH_CLIENTS_FILE: clientsFile,
        MCP_TEST_OAUTH_STATE_FILE: stateFile,
      }),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let output = "";
  child.stdout.on("data", (data) => { output += String(data); });
  child.stderr.on("data", (data) => { output += String(data); });

  try {
    const health = await waitHealth(port);
    assert.equal(health.auth.mode, "oauth21");
    if (health.public_base_url !== undefined) assert.equal(health.public_base_url, issuer);

    const metadata = await json(`${issuer}/.well-known/oauth-authorization-server`);
    assert.equal(metadata.status, 200);
    assert.equal(metadata.body.issuer, issuer);
    assert.equal(metadata.body.registration_endpoint, `${issuer}/register`);
    assert.ok(metadata.body.code_challenge_methods_supported.includes("S256"));

    const protectedResource = await json(`${issuer}/.well-known/oauth-protected-resource`);
    assert.equal(protectedResource.status, 200);
    assert.equal(protectedResource.body.resource, resource);
    assert.deepEqual(protectedResource.body.authorization_servers, [issuer]);

    const registration = await json(`${issuer}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["http://localhost/cb"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }),
    });
    assert.equal(registration.status, 201);
    assert.ok(registration.body.client_id);

    const verifier = crypto.randomBytes(32).toString("base64url");
    const authorizeUrl = new URL(`${issuer}/authorize`);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", registration.body.client_id);
    authorizeUrl.searchParams.set("redirect_uri", "http://localhost/cb");
    authorizeUrl.searchParams.set("code_challenge", sha256Base64Url(verifier));
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("state", "abc");
    authorizeUrl.searchParams.set("scope", "mcp:tools");
    authorizeUrl.searchParams.set("resource", resource);

    const authorization = await fetch(authorizeUrl, { redirect: "manual" });
    assert.equal(authorization.status, 302);
    const loginUrl = authorization.headers.get("location");
    assert.ok(loginUrl?.includes("/oauth/operator-login?pid="));

    const pid = new URL(loginUrl).searchParams.get("pid");
    const loginPage = await fetch(`${issuer}/oauth/operator-login?pid=${encodeURIComponent(pid)}`);
    assert.equal(loginPage.status, 200);
    const loginHtml = await loginPage.text();
    assert.ok(loginHtml.includes(registration.body.client_id));
    assert.ok(loginHtml.includes("http://localhost/cb"));
    assert.ok(loginHtml.includes("mcp:tools"));
    assert.equal(loginPage.headers.get("x-frame-options"), "DENY");
    assert.equal(loginPage.headers.get("x-content-type-options"), "nosniff");
    assert.equal(loginPage.headers.get("referrer-policy"), "no-referrer");
    assert.equal(loginPage.headers.get("content-security-policy"), "frame-ancestors 'none'");

    const rejectedLogin = await fetch(`${issuer}/oauth/operator-login`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        pid,
        client_id: registration.body.client_id,
        redirect_uri: "http://localhost/cb",
        scope: "mcp:tools",
        password: "bad",
      }),
      redirect: "manual",
    });
    assert.equal(rejectedLogin.status, 401);

    const approvedLogin = await fetch(`${issuer}/oauth/operator-login`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        pid,
        client_id: registration.body.client_id,
        redirect_uri: "http://localhost/cb",
        scope: "mcp:tools",
        password: operatorSecret,
      }),
      redirect: "manual",
    });
    assert.equal(approvedLogin.status, 302);

    const callback = new URL(approvedLogin.headers.get("location"));
    assert.equal(callback.origin + callback.pathname, "http://localhost/cb");
    assert.equal(callback.searchParams.get("state"), "abc");
    assert.equal(callback.searchParams.get("iss"), issuer);
    const code = callback.searchParams.get("code");

    const token = await json(`${issuer}/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: "http://localhost/cb",
        client_id: registration.body.client_id,
        code_verifier: verifier,
        resource,
      }),
    });
    assert.equal(token.status, 200);
    assert.ok(token.body.access_token);
    assert.equal(token.headers.get("cache-control"), "no-store");
    assert.equal(token.headers.get("pragma"), "no-cache");

    const reusedCode = await json(`${issuer}/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: "http://localhost/cb",
        client_id: registration.body.client_id,
        code_verifier: verifier,
        resource,
      }),
    });
    assert.equal(reusedCode.status, 400);
    assert.equal(reusedCode.body.error, "invalid_grant");
    assert.equal(reusedCode.headers.get("cache-control"), "no-store");
    assert.equal(reusedCode.headers.get("pragma"), "no-cache");

    const initialize = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "smoke", version: "1" },
      },
    };

    const anonymous = await fetch(`${issuer}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(initialize),
    });
    assert.equal(anonymous.status, 401);

    const authenticated = await fetch(`${issuer}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token.body.access_token}`,
      },
      body: JSON.stringify(initialize),
    });
    assert.equal(authenticated.status, 200);

    console.log("smoke_oauth21_local_as_flow ok");
  } finally {
    child.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  assert.ok(!output.includes("MCP TEST SERVER FAILED"), output);
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
