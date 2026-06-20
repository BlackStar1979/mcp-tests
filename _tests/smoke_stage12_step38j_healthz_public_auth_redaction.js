"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createAuthPolicy } = require("../src/auth/auth_policy");
const { buildPublicHealthAuthStatus } = require("../src/runtime/health_auth_status");
const { handleHealthRoute } = require("../src/runtime/health_route_handler");

const TOKEN = "stage12-step38j-healthz-redaction-token-0123456789abcdef";
const FORBIDDEN_PUBLIC_HEALTH_KEYS = [
  "token_length",
  "token_sha256_prefix",
  "token_loaded",
  "token_file_configured",
  "accepts_query_token",
  "accepts_authorization_bearer",
  "assertion_header",
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
      const address = server.address();
      const port = address && address.port;
      server.close(() => resolve(port));
    });
  });
}

function makeTokenFile() {
  const file = path.join(os.tmpdir(), `mcp-tests-step38j-token-${process.pid}-${Date.now()}.txt`);
  fs.writeFileSync(file, TOKEN, "utf8");
  return file;
}

function assertPublicAuthRedacted(auth, expectedMode) {
  assert.equal(auth.mode, expectedMode);
  assert.equal(typeof auth.enabled, "boolean");
  assert.equal(typeof auth.requires_auth, "boolean");
  assert.equal(auth.public_health_redacted, true);
  assert.equal(auth.public_health_auth_status_version, "public-health-auth-status-v1");

  for (const key of FORBIDDEN_PUBLIC_HEALTH_KEYS) {
    assert.equal(Object.prototype.hasOwnProperty.call(auth, key), false, `public health auth leaked ${key}`);
  }

  assert.deepEqual(Object.keys(auth).sort(), [
    "enabled",
    "mode",
    "public_health_auth_status_version",
    "public_health_redacted",
    "requires_auth",
  ]);
}

function unitHandlerCheck() {
  const tokenFile = makeTokenFile();
  try {
    const bearer = createAuthPolicy({ mode: "bearer", tokenFile });
    const full = bearer.status();
    assert.equal(full.token_length, TOKEN.length);
    assert.match(full.token_sha256_prefix, /^[a-f0-9]{12}$/);

    const publicStatus = buildPublicHealthAuthStatus(bearer);
    assertPublicAuthRedacted(publicStatus, "bearer");

    let body = null;
    handleHealthRoute({
      res: {},
      jsonResponse: (_res, _status, payload) => { body = payload; },
      serverName: "mcp-tests-response-shape",
      serverVersion: "0.30.0",
      connectorShapeVersion: "2025-05-strict-v1",
      outputMode: "structured",
      maxFetchTextChars: 2500,
      auditVersion: "audit-test",
      authPolicy: bearer,
      runtimeProfile: "tests_authenticated",
      stageStatus: "stage12_step38j",
      securityBoundary: { status: "ok" },
      publicBaseUrl: "http://127.0.0.1",
      toolsList: () => [],
    });

    assert.ok(body);
    assertPublicAuthRedacted(body.auth, "bearer");
  } finally {
    try { fs.unlinkSync(tokenFile); } catch (_) {}
  }
}

async function routeCheck() {
  const tokenFile = makeTokenFile();
  const port = await getFreePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MCP_TEST_PORT: String(port),
      MCP_TEST_AUTH_MODE: "bearer",
      MCP_TEST_TOKEN_FILE: tokenFile,
      MCP_TEST_FS_ROOT: path.join(process.cwd(), "_public_sandbox"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (data) => { output += String(data); });
  child.stderr.on("data", (data) => { output += String(data); });

  try {
    let health = null;
    for (let i = 0; i < 60; i += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/healthz`);
        if (response.ok) {
          health = await response.json();
          break;
        }
      } catch (_) {}
      await wait(100);
    }

    assert.ok(health, `bearer healthz did not start: ${output}`);
    assert.equal(health.status, "ok");
    assertPublicAuthRedacted(health.auth, "bearer");

    const mcp = await fetch(`http://127.0.0.1:${port}/mcp`, { method: "POST", body: "{}" });
    assert.equal(mcp.status, 401, "bearer /mcp without token must still require auth");
  } finally {
    child.kill();
    try { fs.unlinkSync(tokenFile); } catch (_) {}
  }
}

(async () => {
  unitHandlerCheck();
  await routeCheck();
  console.log("smoke_stage12_step38j_healthz_public_auth_redaction ok");
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
