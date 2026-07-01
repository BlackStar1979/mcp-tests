"use strict";

// Route matrix contract tests.
//
// Committed contract test for the current HTTP route table. Starts a local
// server child on an isolated ephemeral port (never the active port 3009),
// asserts each route's status, content-type, and stable body fields, then
// stops the listener. Network-independent: usable under run_all_smokes
// --skip-network. Route assertions mirror the source handlers in
// src/runtime/{create_server_route_dispatcher,health_route_handler,
// docs_route_handler,not_found_route_handler}.js and the DOCS fixture in
// server.js. This is a test-only contract; it must not change runtime behavior.

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");

// Isolated local port. Default avoids 3009 (active TEST MCP) and 3095
// (run_all_smokes shared server). Overridable for parallel local runs.
const PORT = Number(process.env.MCP_TEST_ROUTE_MATRIX_PORT || 3096);
const BASE = `http://127.0.0.1:${PORT}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitHealth(port) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return;
    } catch {}
    await wait(100);
  }
  throw new Error("route-matrix health timeout");
}

(async () => {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      // Force the isolated port even if MCP_TEST_PORT is set in the parent env.
      MCP_TEST_PORT: String(PORT),
      MCP_TEST_AUTH_MODE: "none",
      MCP_TEST_HEALTH_FULL: "1",
      MCP_TEST_FS_ROOT: path.join(process.cwd(), "_public_sandbox"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let serverOutput = "";
  child.stdout.on("data", (data) => { serverOutput += String(data); });
  child.stderr.on("data", (data) => { serverOutput += String(data); });

  try {
    await waitHealth(PORT);

    // 1. Root route -> health/root JSON.
    {
      const response = await fetch(`${BASE}/`);
      assert.equal(response.status, 200, "root status");
      assert.ok(
        /application\/json/.test(response.headers.get("content-type") || ""),
        "root content-type includes application/json"
      );
      const body = await response.json();
      assert.equal(body.status, "ok", "root body.status");
      assert.equal(body.mcp, "/mcp", "root body.mcp");
      assert.equal(body.tools_count, 13, "root body.tools_count");
    }

    // 2. Health route -> health/root JSON with contract fields.
    {
      const response = await fetch(`${BASE}/healthz`);
      assert.equal(response.status, 200, "healthz status");
      assert.ok(
        /application\/json/.test(response.headers.get("content-type") || ""),
        "healthz content-type includes application/json"
      );
      const body = await response.json();
      assert.equal(body.status, "ok", "healthz body.status");
      assert.equal(body.mcp, "/mcp", "healthz body.mcp");
      assert.equal(body.auth.mode, "none", "healthz body.auth.mode");
      assert.equal(
        body.connectorShapeVersion,
        "2025-05-strict-v1",
        "healthz body.connectorShapeVersion"
      );
      assert.equal(body.outputMode, "structured", "healthz body.outputMode");
      assert.equal(body.tools_count, 13, "healthz body.tools_count");
      assert.equal(body.tools.length, 13, "healthz body.tools.length");
    }

    // 3. Existing docs route -> 200 text/plain with stable title + token.
    {
      const response = await fetch(`${BASE}/docs/test-mcp-health-canary`);
      assert.equal(response.status, 200, "docs status");
      assert.ok(
        /text\/plain/.test(response.headers.get("content-type") || ""),
        "docs content-type includes text/plain"
      );
      const text = await response.text();
      assert.ok(text.includes("TEST MCP Health Canary"), "docs body contains canary title");
      assert.ok(text.includes("test-mcp-health-canary"), "docs body contains canary token");
    }

    // 4. Missing docs route -> 404 text/plain "Not found".
    {
      const response = await fetch(`${BASE}/docs/not-found-test`);
      assert.equal(response.status, 404, "missing docs status");
      assert.ok(
        /text\/plain/.test(response.headers.get("content-type") || ""),
        "missing docs content-type includes text/plain"
      );
      const text = await response.text();
      assert.ok(text.includes("Not found"), "missing docs body contains Not found");
    }

    // 5. /docs (no trailing slash) -> fallback JSON 404.
    {
      const response = await fetch(`${BASE}/docs`);
      assert.equal(response.status, 404, "/docs fallback status");
      assert.ok(
        /application\/json/.test(response.headers.get("content-type") || ""),
        "/docs fallback content-type includes application/json"
      );
      const body = await response.json();
      assert.equal(body.error, "Not found", "/docs fallback body.error");
    }

    // 6. Unknown route -> fallback JSON 404.
    {
      const response = await fetch(`${BASE}/not-found-test`);
      assert.equal(response.status, 404, "unknown fallback status");
      assert.ok(
        /application\/json/.test(response.headers.get("content-type") || ""),
        "unknown fallback content-type includes application/json"
      );
      const body = await response.json();
      assert.equal(body.error, "Not found", "unknown fallback body.error");
    }

    // 7. MCP route dispatch sanity (ping). Deeper MCP behavior is Step 95.
    {
      const response = await fetch(`${BASE}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
      });
      assert.equal(response.status, 200, "mcp ping status");
      const body = await response.json();
      assert.equal(body.jsonrpc, "2.0", "mcp ping jsonrpc");
      assert.equal(body.id, 1, "mcp ping id");
      assert.ok(body.result !== undefined, "mcp ping result exists");
    }

    console.log("smoke_route_matrix_contract ok");
  } catch (error) {
    if (serverOutput) console.error(serverOutput);
    throw error;
  } finally {
    child.kill();
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
