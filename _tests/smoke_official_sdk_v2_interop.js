"use strict";

// End-to-end interoperability with the official MCP TypeScript client v2.
// Each client gets a fresh transport against one hermetic server on an
// isolated port. Server audit assertions prove which entry path was used.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  Client,
  StreamableHTTPClientTransport,
} = require("@modelcontextprotocol/client");
const { withHermeticServerControlEnv } = require("./helpers/hermetic_server_control_env");

const CLIENT_VERSION = "2.0.0";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function freePort() {
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
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) return;
    } catch {}
    await wait(100);
  }
  throw new Error("official-sdk-v2 interop health timeout");
}

function readAudit(auditPath) {
  return fs.readFileSync(auditPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function exerciseClient(label, options, expectedEra, expectedVersion, mcpUrl) {
  const clientName = `mcp-tests-official-sdk-${label}`;
  const client = new Client({ name: clientName, version: CLIENT_VERSION }, options);
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));

  try {
    await client.connect(transport);
    assert.equal(client.getProtocolEra(), expectedEra, `${label} protocol era`);
    assert.equal(
      client.getNegotiatedProtocolVersion(),
      expectedVersion,
      `${label} negotiated protocol version`
    );

    const toolList = await client.listTools();
    assert.equal(toolList.tools.length, 13, `${label} public tool count`);
    assert.ok(
      toolList.tools.some((tool) => tool.name === "fs_get_public_info"),
      `${label} exposes fs_get_public_info`
    );

    const call = await client.callTool({
      name: "fs_get_public_info",
      arguments: { path: "docs/hello.txt" },
    });
    assert.notEqual(call.isError, true, `${label} tool call succeeds`);
    assert.equal(call.structuredContent?.success, true, `${label} structured success`);
    assert.equal(call.structuredContent?.kind, "file", `${label} structured kind`);
  } finally {
    await client.close().catch(() => {});
  }

  return clientName;
}

(async () => {
  const packageJson = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "node_modules", "@modelcontextprotocol", "client", "package.json"),
    "utf8"
  ));
  assert.equal(packageJson.version, CLIENT_VERSION, "official client version is pinned");

  const port = await freePort();
  const mcpUrl = `http://127.0.0.1:${port}/mcp`;
  const controlRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-official-sdk-v2-"));
  const auditPath = path.join(controlRoot, "audit.jsonl");
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: withHermeticServerControlEnv({
      ...process.env,
      MCP_TEST_PORT: String(port),
      MCP_TEST_AUTH_MODE: "none",
      MCP_TEST_FS_ROOT: path.join(__dirname, "..", "_public_sandbox"),
      MCP_TEST_AUDIT_LOG: auditPath,
    }, controlRoot),
    stdio: ["ignore", "pipe", "pipe"],
  });

  let serverOutput = "";
  child.stdout.on("data", (data) => { serverOutput += String(data); });
  child.stderr.on("data", (data) => { serverOutput += String(data); });

  try {
    await waitHealth(port);
    const legacyClient = await exerciseClient(
      "legacy",
      undefined,
      "legacy",
      "2025-11-25",
      mcpUrl
    );
    const autoClient = await exerciseClient(
      "auto",
      { versionNegotiation: { mode: "auto" } },
      "modern",
      "2026-07-28",
      mcpUrl
    );
    const pinnedClient = await exerciseClient(
      "pinned",
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
      "modern",
      "2026-07-28",
      mcpUrl
    );

    const audit = readAudit(auditPath);
    const initializes = audit.filter((entry) => entry.event === "initialize_received");
    const discovers = audit.filter((entry) => entry.event === "server_discover_received");
    assert.equal(initializes.length, 1, "only the legacy client initializes");
    assert.equal(initializes[0].client_name, legacyClient, "legacy audit client identity");
    assert.equal(initializes[0].protocol_version, "2025-11-25", "legacy audit version");
    assert.deepEqual(
      discovers.map((entry) => entry.client_name),
      [autoClient, pinnedClient],
      "auto and pinned clients use server/discover"
    );
    assert.ok(
      discovers.every((entry) => entry.protocol_version === "2026-07-28"),
      "modern audit versions"
    );
    assert.equal(
      audit.filter((entry) => entry.event === "tool_call_end" && entry.tool === "fs_get_public_info").length,
      3,
      "all three SDK clients complete a real tool call"
    );
  } catch (error) {
    if (serverOutput) console.error(serverOutput);
    throw error;
  } finally {
    child.kill();
    fs.rmSync(controlRoot, { recursive: true, force: true });
  }

  console.log("smoke_official_sdk_v2_interop ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
