"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const {
  AUTH_PUBLIC_BASE_URLS,
  resolveAuthBootstrapConfig,
} = require("../src/runtime/auth_bootstrap_config_resolver");

const ROOT = path.join(__dirname, "..");
const TOKEN = "stage12-public-url-token-0123456789abcdef";
const EXPECTED_COMBINED_FINGERPRINT = "fb2cede646129d47";

function cleanEnv(overrides = {}) {
  const env = { ...process.env };
  delete env.MCP_TEST_AUTH_MODE;
  delete env.MCP_TEST_PORT;
  delete env.MCP_TEST_TOKEN_FILE;
  delete env.MCP_TEST_HOST;
  delete env.MCP_TEST_PUBLIC_BASE_URL;
  return { ...env, ...overrides };
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

async function waitFor(predicate, label) {
  for (let i = 0; i < 60; i += 1) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function rpc({ port, headers = {}, method = "tools/list", params = {} }) {
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function callTool({ port, headers = {}, name, args = {} }) {
  const response = await rpc({
    port,
    headers,
    method: "tools/call",
    params: { name, arguments: args },
  });
  assert.equal(response.status, 200);
  return JSON.parse(response.body.result.content[0].text);
}

async function withServer({ argv = [], env = {}, headers = {}, expectedAuthMode, expectedPublicBaseUrl }) {
  const port = await getFreePort();
  assert.notEqual(port, 3009, "test child must not bind active public fallback port 3009");

  const profileArgs = expectedAuthMode === "none" ? [] : ["--profile", "tests"];
  const child = spawn(process.execPath, ["server.js", ...profileArgs, ...argv, "--port", String(port)], {
    cwd: ROOT,
    env: cleanEnv({
      ...env,
      MCP_TEST_FS_ROOT: path.join(ROOT, "_public_sandbox"),
    }),
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (data) => { output += String(data); });
  child.stderr.on("data", (data) => { output += String(data); });

  try {
    const health = await waitFor(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/healthz`);
        if (response.ok) return response.json();
      } catch {}
      return undefined;
    }, `health on ${port}`);

    await waitFor(
      async () => output.includes(`Auth mode: ${expectedAuthMode}`) && output.includes(`Public: ${expectedPublicBaseUrl}/mcp`),
      "startup output"
    );

    assert.equal(health.auth.mode, expectedAuthMode);
    if (health.public_base_url !== undefined) {
      assert.equal(health.public_base_url, expectedPublicBaseUrl);
    }

    let runtime = null;
    if (expectedAuthMode !== "none") {
      runtime = await callTool({
        port,
        headers,
        name: "test_mcp_runtime_status",
        args: { include_tools: true },
      });
      assert.equal(runtime.auth.mode, expectedAuthMode);
      assert.equal(runtime.host, "127.0.0.1");
      assert.equal(runtime.port, port);
      assert.equal(runtime.public_base_url, expectedPublicBaseUrl);
      assert.equal(runtime.tool_surface.tool_count, 46);
      assert.equal(runtime.tool_surface.combined_fingerprint, EXPECTED_COMBINED_FINGERPRINT);
    }

    if (expectedAuthMode !== "oauth21") assert.doesNotMatch(output, /Auth mode: .*oauth/i);
    return { output, health, runtime };
  } finally {
    child.kill();
  }
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-stage12-public-url-"));
  const tokenFile = path.join(tmp, "token.txt");
  fs.writeFileSync(tokenFile, TOKEN, { encoding: "utf8", mode: 0o600 });

  try {
    assert.equal(AUTH_PUBLIC_BASE_URLS.none, "https://mcp-tests.romionologic.dev");
    assert.equal(AUTH_PUBLIC_BASE_URLS.bearer, "https://mcp-tests-bearer.romionologic.dev");
    assert.equal(AUTH_PUBLIC_BASE_URLS.access, "https://mcp-tests-access.romionologic.dev");
    assert.equal(AUTH_PUBLIC_BASE_URLS.oauth21, "https://mcp-tests-oauth21.romionologic.dev");

    assert.equal(
      resolveAuthBootstrapConfig({ argv: [], env: cleanEnv() }).publicBaseUrl,
      AUTH_PUBLIC_BASE_URLS.none
    );
    assert.equal(
      resolveAuthBootstrapConfig({ argv: ["--auth", "bearer"], env: cleanEnv() }).publicBaseUrl,
      AUTH_PUBLIC_BASE_URLS.bearer
    );
    assert.equal(
      resolveAuthBootstrapConfig({ argv: ["--auth", "access"], env: cleanEnv() }).publicBaseUrl,
      AUTH_PUBLIC_BASE_URLS.access
    );

    {
      const config = resolveAuthBootstrapConfig({
        argv: ["--auth", "bearer"],
        env: cleanEnv({ MCP_TEST_PUBLIC_BASE_URL: "https://override.example.test////" }),
      });
      assert.equal(config.publicBaseUrl, "https://override.example.test");
      assert.equal(config.publicBaseUrlSource, "env");
    }

    await withServer({
      argv: ["--auth", "none"],
      expectedAuthMode: "none",
      expectedPublicBaseUrl: AUTH_PUBLIC_BASE_URLS.none,
    });

    await withServer({
      argv: ["--auth", "bearer", "--token-file", tokenFile],
      headers: { authorization: `Bearer ${TOKEN}` },
      expectedAuthMode: "bearer",
      expectedPublicBaseUrl: AUTH_PUBLIC_BASE_URLS.bearer,
    });

    await withServer({
      argv: ["--auth", "access"],
      env: { MCP_TEST_ACCESS_TRUSTED_PROXY: "1" },
      headers: { "cf-access-jwt-assertion": "stage12-public-url-access-assertion" },
      expectedAuthMode: "access",
      expectedPublicBaseUrl: AUTH_PUBLIC_BASE_URLS.access,
    });

    await withServer({
      argv: ["--auth", "access"],
      env: { MCP_TEST_PUBLIC_BASE_URL: "https://custom-public.example.test", MCP_TEST_ACCESS_TRUSTED_PROXY: "1" },
      headers: { "cf-access-jwt-assertion": "stage12-public-url-access-assertion" },
      expectedAuthMode: "access",
      expectedPublicBaseUrl: "https://custom-public.example.test",
    });

    {
      const result = spawnSync(process.execPath, ["server.js", "--auth", "oauth"], {
        cwd: ROOT, env: cleanEnv(), encoding: "utf8", timeout: 10000,
      });
      assert.notEqual(result.status, 0, "oauth must fail closed without issuer");
      assert.match(`${result.stdout}\n${result.stderr}`, /MCP_TEST_OAUTH_ISSUER is required/);
      assert.doesNotMatch(result.stdout, /Public:/);
    }
    {
      const result = spawnSync(process.execPath, ["server.js", "--auth", "oauth21"], {
        cwd: ROOT, env: cleanEnv(), encoding: "utf8", timeout: 10000,
      });
      assert.notEqual(result.status, 0, "oauth21 must fail closed without operator secret");
      assert.match(`${result.stdout}\n${result.stderr}`, /OAUTH_OPERATOR_SECRET|operator_secret/);
      assert.doesNotMatch(result.stdout, /Public:/);
    }

    const selfTest = spawnSync(process.execPath, ["server.js", "--self-test"], {
      cwd: ROOT,
      env: cleanEnv(),
      encoding: "utf8",
      timeout: 20000,
    });
    assert.equal(selfTest.status, 0, `self-test must pass\nSTDOUT:\n${selfTest.stdout}\nSTDERR:\n${selfTest.stderr}`);
    assert.match(selfTest.stdout, /self-test ok/);

    console.log("smoke_stage12_public_base_url_auth_mode_mapping ok");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
