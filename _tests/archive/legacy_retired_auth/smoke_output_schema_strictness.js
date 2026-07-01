"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function auditStrictOutputSchema(schema, tool, issues) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    issues.push({ tool, path: "outputSchema", issue: "schema_not_object" });
    return;
  }

  if (schema.type !== "object") {
    issues.push({ tool, path: "outputSchema.type", issue: "type_not_object", actual: schema.type ?? null });
  }

  if (!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) {
    issues.push({ tool, path: "outputSchema.properties", issue: "missing_or_nonobject_properties" });
  }

  if (schema.additionalProperties !== false) {
    issues.push({ tool, path: "outputSchema.additionalProperties", issue: "not_false", actual: schema.additionalProperties ?? null });
  }
}

async function listTools({ profile, auth }) {
  const port = await getFreePort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-step38k-schema-"));
  const tokenFile = path.join(tmp, "token.txt");
  const token = "stage12-step38k-schema-token-0123456789abcdef";
  fs.writeFileSync(tokenFile, token, "utf8");

  const args = ["server.js", "--profile", profile, "--auth", auth, "--port", String(port)];
  if (auth === "bearer") args.push("--token-file", tokenFile);

  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: { ...process.env, MCP_TEST_FS_ROOT: path.join(process.cwd(), "_public_sandbox") },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (data) => { output += String(data); });
  child.stderr.on("data", (data) => { output += String(data); });

  try {
    for (let i = 0; i < 60; i += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/healthz`);
        if (response.ok) break;
      } catch (_) {}
      await wait(100);
    }

    const headers = { "content-type": "application/json" };
    if (auth === "bearer") headers.authorization = `Bearer ${token}`;

    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: `${profile}-${auth}-tools-list`, method: "tools/list", params: {} }),
    });
    const body = await response.json();
    assert.equal(response.status, 200, `${profile}/${auth} tools/list failed: ${JSON.stringify(body)} ${output}`);
    return body.result.tools || [];
  } finally {
    child.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

(async () => {
  const publicTools = await listTools({ profile: "public", auth: "none" });
  const authenticatedTools = await listTools({ profile: "tests", auth: "bearer" });
  const issues = [];

  for (const tool of publicTools) auditStrictOutputSchema(tool.outputSchema, tool.name, issues);
  for (const tool of authenticatedTools) auditStrictOutputSchema(tool.outputSchema, tool.name, issues);

  assert.equal(publicTools.length, 13);
  assert.equal(authenticatedTools.length, 46);
  assert.deepEqual(issues, []);

  console.log("smoke_stage12_step38k_output_schema_strictness ok");
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
