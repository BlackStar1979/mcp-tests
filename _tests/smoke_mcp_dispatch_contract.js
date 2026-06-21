"use strict";

// Stage 8 / Step 95 - MCP Dispatch Contract Tests.
//
// Committed contract test for HTTP /mcp JSON-RPC dispatch behavior. Starts a
// local server child on an isolated ephemeral port (never the active port
// 3009), exercises single/batch/notification/parse-error/method-not-allowed/
// unknown-method/initialize paths over HTTP, then stops the listener.
// Network-independent: usable under run_all_smokes --skip-network. Assertions
// mirror the source dispatchers in src/runtime/{mcp_entry_dispatcher,
// batch_payload_dispatcher,single_payload_dispatcher,request_body_parse_handler,
// method_not_allowed_handler,rpc_message_dispatcher,rpc_no_response,
// method_not_found_response}.js and src/runtime/http_responses.js. This is a
// test-only step; it must not change runtime behavior.
//
// Auth rejection is intentionally NOT exercised here: bearer-mode rejection is
// already covered by _tests/smoke_stage2_auth.js at the auth-policy level
// (missing -> 401 missing_bearer_token, invalid -> 401 invalid_bearer_token).
// Step 95 keeps the default authMode=none server and adds no ad hoc auth harness.

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");

const PORT = Number(process.env.MCP_TEST_MCP_DISPATCH_PORT || 3097);
const MCP_URL = `http://127.0.0.1:${PORT}/mcp`;

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
  throw new Error("mcp-dispatch health timeout");
}

// POST a raw JSON-RPC body (string) to /mcp.
function postRaw(rawBody) {
  return fetch(MCP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: rawBody,
  });
}

// POST a JSON-RPC value (object or array) to /mcp.
function postJson(value) {
  return postRaw(JSON.stringify(value));
}

(async () => {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MCP_TEST_PORT: String(PORT),
      MCP_TEST_AUTH_MODE: "none",
      MCP_TEST_FS_ROOT: path.join(process.cwd(), "_public_sandbox"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let serverOutput = "";
  child.stdout.on("data", (data) => { serverOutput += String(data); });
  child.stderr.on("data", (data) => { serverOutput += String(data); });

  try {
    await waitHealth(PORT);

    // 1. Single ping -> 200 with result.
    {
      const response = await postJson({ jsonrpc: "2.0", id: 1, method: "ping", params: {} });
      assert.equal(response.status, 200, "single ping status");
      const body = await response.json();
      assert.equal(body.jsonrpc, "2.0", "single ping jsonrpc");
      assert.equal(body.id, 1, "single ping id");
      assert.ok(body.result !== undefined, "single ping result exists");
    }

    // 2. Single notification-only request -> 204, empty body.
    {
      const response = await postJson({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      });
      assert.equal(response.status, 204, "single notification status");
      const text = await response.text();
      assert.equal(text, "", "single notification empty body");
    }

    // 3. Batch ping -> 200 array of 2 ordered responses.
    {
      const response = await postJson([
        { jsonrpc: "2.0", id: 1, method: "ping", params: {} },
        { jsonrpc: "2.0", id: 2, method: "ping", params: {} },
      ]);
      assert.equal(response.status, 200, "batch ping status");
      const body = await response.json();
      assert.ok(Array.isArray(body), "batch ping body is array");
      assert.equal(body.length, 2, "batch ping length");
      assert.equal(body[0].id, 1, "batch ping body[0].id");
      assert.equal(body[1].id, 2, "batch ping body[1].id");
      assert.ok(body[0].result !== undefined, "batch ping body[0].result exists");
      assert.ok(body[1].result !== undefined, "batch ping body[1].result exists");
    }

    // 4. Notification-only batch -> 204, empty body.
    {
      const response = await postJson([
        { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
      ]);
      assert.equal(response.status, 204, "notification batch status");
      const text = await response.text();
      assert.equal(text, "", "notification batch empty body");
    }

    // 5. Malformed JSON parse error -> 400 JSON-RPC parse error.
    {
      const response = await postRaw("{");
      assert.equal(response.status, 400, "parse error status");
      const body = await response.json();
      assert.equal(body.jsonrpc, "2.0", "parse error jsonrpc");
      assert.equal(body.id, null, "parse error id");
      assert.equal(body.error.code, -32700, "parse error code");
    }

    // 6. Non-POST method-not-allowed -> 405.
    {
      const response = await fetch(MCP_URL, { method: "GET" });
      assert.equal(response.status, 405, "method-not-allowed status");
      assert.ok(
        /application\/json/.test(response.headers.get("content-type") || ""),
        "method-not-allowed content-type"
      );
      const body = await response.json();
      assert.equal(body.id, null, "method-not-allowed id");
      assert.equal(body.error.code, -32000, "method-not-allowed error code");
      assert.equal(
        body.error.message,
        "Method not allowed. Use POST /mcp.",
        "method-not-allowed message"
      );
    }

    // 7. Unknown single method -> 200 JSON-RPC method-not-found.
    {
      const response = await postJson({
        jsonrpc: "2.0",
        id: 99,
        method: "unknown/test",
        params: {},
      });
      assert.equal(response.status, 200, "unknown method status");
      const body = await response.json();
      assert.equal(body.jsonrpc, "2.0", "unknown method jsonrpc");
      assert.equal(body.id, 99, "unknown method id");
      assert.equal(body.error.code, -32601, "unknown method error code");
    }

    // 8. Initialize over HTTP -> 200 with stable serverInfo contract.
    {
      const response = await postJson({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "step95-dispatch-smoke", version: "0" },
        },
      });
      assert.equal(response.status, 200, "initialize status");
      const body = await response.json();
      const result = body.result;
      assert.ok(result, "initialize result exists");
      assert.equal(result.protocolVersion, "2025-06-18", "initialize protocolVersion");
      assert.equal(result.capabilities.tools.listChanged, false, "initialize listChanged");
      assert.equal(result.serverInfo.name, "mcp-tests-response-shape", "initialize serverInfo.name");
      assert.equal(result.serverInfo.version, "0.40.0", "initialize serverInfo.version");
      assert.equal(
        result.serverInfo.connectorShapeVersion,
        "2025-05-strict-v1",
        "initialize serverInfo.connectorShapeVersion"
      );
      assert.equal(result.serverInfo.outputMode, "structured", "initialize serverInfo.outputMode");
      assert.equal(result.serverInfo.authMode, "none", "initialize serverInfo.authMode");
      assert.equal(result.serverInfo.profile, "public", "initialize serverInfo.profile");
      assert.equal(
        result.serverInfo.toolSurface.tool_count,
        13,
        "initialize serverInfo.toolSurface.tool_count"
      );
    }

    console.log("smoke_mcp_dispatch_contract ok");
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
