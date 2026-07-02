"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const ACCESS_HEADERS = { "cf-access-jwt-assertion": "stage13-public-profile-access" };
const TOKEN = "stage13-public-profile-token-0123456789abcdef";
const PUBLIC_ALLOWED = new Set([
  "search",
  "fetch",
  "net_http_get_allowlisted",
  "net_fetch_text_allowlisted",
  "net_check_url_head",
  "net_fetch_github_raw",
  "net_check_npm_package",
  "net_check_pypi_package",
  "fs_list_public",
  "fs_get_public_info",
  "fs_read_public_text",
  "fs_read_public_lines",
  "fs_read_public_chunk",
]);

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
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
async function waitHealth(port, headers = {}) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`, { headers });
      if (response.ok) return response.json();
    } catch {}
    await wait(100);
  }
  throw new Error(`health timeout on ${port}`);
}
async function rpc(port, method, params = {}, headers = {}) {
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: `${method}-${Date.now()}`, method, params }),
  });
  return { status: response.status, body: await response.json() };
}
function start(args, env = {}) {
  return spawn(process.execPath, ["server.js", ...args], {
    cwd: ROOT,
    env: { ...process.env, MCP_TEST_FS_ROOT: path.join(ROOT, "_public_sandbox"), ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}
function toolNames(listResponse) {
  return (listResponse.body.result?.tools || []).map((tool) => tool.name).sort();
}
function assertPublicOnly(names, label) {
  assert.ok(names.length > 0, `${label} must expose some public tools`);
  for (const name of names) assert.ok(PUBLIC_ALLOWED.has(name), `${label} leaked non-public tool ${name}`);
  assert.equal(names.includes("memory_save"), false, `${label} must not expose memory_save`);
  assert.equal(names.includes("test_mcp_runtime_status"), false, `${label} must not expose runtime status`);
  assert.equal(names.includes("observability_status"), false, `${label} must not expose observability status`);
}
async function withServer(args, headers, validate, env = {}) {
  const port = await getFreePort();
  const child = start([...args, "--port", String(port)], env);
  try {
    await waitHealth(port, headers);
    await validate(port);
  } finally {
    child.kill();
  }
}

(async () => {
  await withServer([], {}, async (port) => {
    const list = await rpc(port, "tools/list", {});
    assert.equal(list.status, 200);
    assertPublicOnly(toolNames(list), "default profile/auth none");
  });

  await withServer(["--profile", "public"], {}, async (port) => {
    const list = await rpc(port, "tools/list", {});
    assert.equal(list.status, 200);
    assertPublicOnly(toolNames(list), "explicit public/auth none");
  });

  await withServer(["--profile", "public", "--auth", "access"], ACCESS_HEADERS, async (port) => {
    const missing = await rpc(port, "tools/list", {});
    assert.equal(missing.status, 401);
    const list = await rpc(port, "tools/list", {}, ACCESS_HEADERS);
    assert.equal(list.status, 200);
    assertPublicOnly(toolNames(list), "explicit public/access");
  });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-public-profile-"));
  const tokenFile = path.join(tmp, "token.txt");
  fs.writeFileSync(tokenFile, TOKEN, "utf8");
  try {
    await withServer(["--profile", "public", "--auth", "bearer", "--token-file", tokenFile], { authorization: `Bearer ${TOKEN}` }, async (port) => {
      const missing = await rpc(port, "tools/list", {});
      assert.equal(missing.status, 401);
      const list = await rpc(port, "tools/list", {}, { authorization: `Bearer ${TOKEN}` });
      assert.equal(list.status, 200);
      assertPublicOnly(toolNames(list), "explicit public/bearer");
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log("smoke_stage13_public_profile_visibility ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
