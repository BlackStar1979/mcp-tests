const assert = require("node:assert/strict");
const { CURRENT_STAGE_STATUS } = require("../src/stage_metadata");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const PORT = Number(process.env.MCP_TEST_STAGE7_2_PORT || 3096);
const TOKEN = "stage7-2-test-token-0123456789abcdefghijklmnopqrstuvwxyz";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitHealth(port, headers = {}) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`, { headers });
      if (response.ok) return response.json();
    } catch {}
    await wait(100);
  }
  throw new Error("health timeout");
}

async function rpc(port, headers = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: "stage7-2", method: "tools/list", params: {} }),
  });
  return { status: response.status, body: await response.json() };
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-stage7-2-"));
  const tokenFile = path.join(tmp, "token.txt");
  fs.writeFileSync(tokenFile, TOKEN, "utf8");

  const child = spawn(process.execPath, ["server.js", "--profile", "tests", "--auth", "bearer", "--token-file", tokenFile, "--port", String(PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (data) => { output += String(data); });
  child.stderr.on("data", (data) => { output += String(data); });

  try {
    const health = await waitHealth(PORT);
    assert.equal(health.version, "0.30.0");
    assert.equal(health.stage_status, CURRENT_STAGE_STATUS);
    assert.equal(health.profile, "internal");
    assert.equal(health.auth.mode, "bearer");
    assert.equal(health.auth.requires_auth, true);
    assert.equal(health.security_boundary.status, "ok");
    assert.equal(health.security_boundary.internal_profile, true);
    assert.equal(health.security_boundary.plugin_execution_allowed, false);

    const missing = await rpc(PORT);
    assert.equal(missing.status, 401);
    assert.equal(missing.body.error.data.auth_error, "missing_bearer_token");

    const invalid = await rpc(PORT, { authorization: "Bearer wrong-token" });
    assert.equal(invalid.status, 401);
    assert.equal(invalid.body.error.data.auth_error, "invalid_bearer_token");

    const valid = await rpc(PORT, { authorization: `Bearer ${TOKEN}` });
    assert.equal(valid.status, 200);
    assert.ok(Array.isArray(valid.body.result.tools));
    const names = valid.body.result.tools.map((tool) => tool.name);
    assert.ok(valid.body.result.tools.length >= 40);
    assert.ok(names.includes("memory_save"));

    console.log("smoke_stage7_2_internal_auth_runtime ok");
  } finally {
    child.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
