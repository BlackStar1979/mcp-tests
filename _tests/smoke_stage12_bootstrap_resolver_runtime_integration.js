"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { resolveAuthBootstrapConfig } = require("../src/runtime/auth_bootstrap_config_resolver");

const ROOT = path.join(__dirname, "..");
const TOKEN = "stage12-bootstrap-runtime-token-0123456789abcdef";
const EXPECTED_COMBINED_FINGERPRINT = "e2d4957058b360f2";

function cleanEnv(overrides = {}) {
  const env = { ...process.env, ...overrides };
  delete env.MCP_TEST_AUTH_MODE;
  delete env.MCP_TEST_PORT;
  delete env.MCP_TEST_TOKEN_FILE;
  delete env.MCP_TEST_HOST;
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

async function waitHealth(port) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`health timeout on ${port}`);
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
  const text = response.body.result?.content?.[0]?.text || "";
  assert.ok(text, `${name} must return JSON text content`);
  return JSON.parse(text);
}

async function withServer({ argv = [], env = {}, assertFn }) {
  const port = await getFreePort();
  assert.notEqual(port, 3009, "test child must not bind active public fallback port 3009");
  const child = spawn(process.execPath, ["server.js", ...argv, "--port", String(port)], {
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
    const health = await waitHealth(port);
    await assertFn({ port, health, output });
  } finally {
    child.kill();
  }
}

function assertFailsClosed(args, pattern) {
  const result = spawnSync(process.execPath, ["server.js", ...args], {
    cwd: ROOT,
    env: cleanEnv(),
    encoding: "utf8",
    timeout: 10000,
  });
  assert.notEqual(result.status, 0, `server.js ${args.join(" ")} must fail closed`);
  assert.match(`${result.stdout}\n${result.stderr}`, pattern);
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-stage12-bootstrap-"));
  const tokenFile = path.join(tmp, "token.txt");
  fs.writeFileSync(tokenFile, TOKEN, { encoding: "utf8", mode: 0o600 });

  try {
    {
      const config = resolveAuthBootstrapConfig({ argv: [], env: cleanEnv() });
      assert.equal(config.authMode, "none");
      assert.equal(config.port, 3009);
    }

    {
      assert.throws(() => resolveAuthBootstrapConfig({ argv: ["--auth", "bearer", "--token-file", tokenFile], env: cleanEnv() }), /Retired auth mode/);
    }

    {
      assert.throws(() => resolveAuthBootstrapConfig({ argv: ["--auth", "access"], env: cleanEnv() }), /Retired auth mode/);
    }

    {
      const config = resolveAuthBootstrapConfig({ argv: ["--auth", "none", "--port", "3019"], env: cleanEnv() });
      assert.equal(config.authMode, "none");
      assert.equal(config.port, 3019);
    }

    {
      assert.throws(() => resolveAuthBootstrapConfig({ argv: [], env: cleanEnv({ MCP_TEST_AUTH_MODE: "bearer", MCP_TEST_TOKEN_FILE: tokenFile }) }), /Retired auth mode/);
    }

    {
      assert.throws(() => resolveAuthBootstrapConfig({ argv: [], env: cleanEnv({ MCP_TEST_AUTH_MODE: "access" }) }), /Retired auth mode/);
    }

    {
      assert.throws(() => resolveAuthBootstrapConfig({ argv: ["--auth", "access", "--port", "4020"], env: cleanEnv({ MCP_TEST_AUTH_MODE: "bearer", MCP_TEST_PORT: "4019", MCP_TEST_TOKEN_FILE: tokenFile }) }), /Retired auth mode/);
    }

    await withServer({
      argv: ["--auth", "none"],
      assertFn: async ({ health }) => {
        assert.equal(health.auth.mode, "none");
        assert.ok(!health.tools || health.tools.length === 13);
      },
    });

    await withServer({
      argv: ["--auth", "none"],
      env: { MCP_TEST_AUTH_MODE: "bearer", MCP_TEST_PORT: "4019", MCP_TEST_TOKEN_FILE: tokenFile },
      assertFn: async ({ health }) => {
        assert.equal(health.auth.mode, "none");
        assert.ok(!health.tools || health.tools.length === 13);
      },
    });

    assertFailsClosed(["--auth", "invalid"], /Invalid auth mode/);
    assertFailsClosed(["--auth", "access"], /Retired auth mode/);
    assertFailsClosed(["--auth", "bearer"], /Retired auth mode/);
    assertFailsClosed(["--port", "0"], /Invalid port/);
    assertFailsClosed(["--auth", "oauth"], /MCP_TEST_OAUTH_ISSUER is required/);
    assertFailsClosed(["--auth", "oauth21"], /OAUTH_OPERATOR_SECRET|operator_secret/);

    const selfTest = spawnSync(process.execPath, ["server.js", "--self-test"], {
      cwd: ROOT,
      env: cleanEnv(),
      encoding: "utf8",
      timeout: 20000,
    });
    assert.equal(selfTest.status, 0, `self-test must pass\nSTDOUT:\n${selfTest.stdout}\nSTDERR:\n${selfTest.stderr}`);
    assert.match(selfTest.stdout, /self-test ok/);

    console.log("smoke_stage12_bootstrap_resolver_runtime_integration ok");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
