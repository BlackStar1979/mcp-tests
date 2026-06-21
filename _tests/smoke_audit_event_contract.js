"use strict";

// Stage 8 / Step 96 - Audit Event Contract Tests.
//
// Committed contract test for the stable, redaction-safe audit envelope. Starts
// a local server child on an isolated ephemeral port (never the active port
// 3009) with an ISOLATED temporary audit log (never the active production log
// C:\Work\mcp-tests\_logs\.mcp-tests-audit.jsonl), drives a few representative
// /mcp requests, then reads the JSONL audit records and asserts the stable
// envelope + redaction safety. Network-independent: usable under run_all_smokes
// --skip-network. Field names mirror src/runtime/{audit_log,rpc_audit_summary,
// tool_audit_helpers}.js, src/runtime/{single_payload_dispatcher,
// batch_payload_dispatcher,request_body_parse_handler}.js, and the server_start
// record in server.js. This is a test-only step; it must not change runtime or
// audit behavior. Volatile fields (ts, durations, request ids, raw paths,
// parse-error message text) are not asserted exactly.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const PORT = Number(process.env.MCP_TEST_AUDIT_PORT || 3098);
const MCP_URL = `http://127.0.0.1:${PORT}/mcp`;
const ACCESS_HEADERS = { "cf-access-jwt-assertion": "audit-event-contract-access" };

// Isolated temporary audit log. Never the active production audit log.
const AUDIT_LOG_PATH = path.join(
  os.tmpdir(),
  `mcp-tests-audit-step96-${process.pid}-${Date.now()}.jsonl`
);

// Stable contract baseline (from src/runtime/identity.js).
const SERVER_NAME = "mcp-tests-response-shape";
const SERVER_VERSION = "0.40.0";
const CONNECTOR_SHAPE_VERSION = "2025-05-strict-v1";

// Redaction forbidden strings. None of these may appear in a clean audit log.
const FORBIDDEN_STRINGS = [
  "Authorization",
  "Bearer ",
  "test-secret",
  "MCP_AUTH_BEARER_TOKEN",
  "OPENAI",
  "API_KEY",
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitHealth(port) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`, { headers: ACCESS_HEADERS });
      if (response.ok) return;
    } catch {}
    await wait(100);
  }
  throw new Error("audit-contract health timeout");
}

function postRaw(rawBody) {
  return fetch(MCP_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...ACCESS_HEADERS },
    body: rawBody,
  });
}

function postJson(value) {
  return postRaw(JSON.stringify(value));
}

(async () => {
  const child = spawn(process.execPath, ["server.js", "--profile", "tests", "--auth", "access", "--port", String(PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MCP_TEST_FS_ROOT: path.join(process.cwd(), "_public_sandbox"),
      // Fully isolate audit output to a temp file; production log untouched.
      MCP_TEST_AUDIT_LOG: AUDIT_LOG_PATH,
      MCP_TEST_LOG_DIR: os.tmpdir(),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let serverOutput = "";
  child.stdout.on("data", (data) => { serverOutput += String(data); });
  child.stderr.on("data", (data) => { serverOutput += String(data); });

  try {
    await waitHealth(PORT);

    // Generate representative, default-safe audit events.
    await postJson({ jsonrpc: "2.0", id: 1, method: "ping", params: {} });
    await postJson({ jsonrpc: "2.0", id: 99, method: "unknown/test", params: {} });
    await postRaw("{");
    await postJson({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
    // tools/call against a default-profile, no-network, no-secret tool.
    await postJson({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "test_mcp_runtime_status", arguments: {} },
    });

    // Audit writes are synchronous in the child and happen before each HTTP
    // response resolves; a short settle keeps this robust regardless.
    await wait(100);

    const rawLog = fs.readFileSync(AUDIT_LOG_PATH, "utf8");
    const lines = rawLog.split("\n").filter((line) => line.trim().length > 0);
    assert.ok(lines.length >= 4, "audit log has records");

    const records = lines.map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`audit line ${index} is not valid JSON: ${error.message}`);
      }
    });

    // Stable envelope on every record.
    for (const record of records) {
      assert.equal(typeof record.ts, "string", "record.ts is string");
      assert.equal(typeof record.audit_version, "string", "record.audit_version is string");
      assert.equal(record.server, SERVER_NAME, "record.server");
      assert.equal(record.server_version, SERVER_VERSION, "record.server_version");
      assert.equal(
        record.connectorShapeVersion,
        CONNECTOR_SHAPE_VERSION,
        "record.connectorShapeVersion"
      );
      assert.equal(typeof record.event, "string", "record.event is string");
    }

    const byEvent = (event) => records.filter((record) => record.event === event);

    // server_start record exists with a stable shape.
    {
      const starts = byEvent("server_start");
      assert.ok(starts.length >= 1, "server_start record present");
      assert.equal(typeof starts[0].port, "number", "server_start.port is number");
    }

    // rpc_received records carry the stable request envelope.
    const rpcReceived = byEvent("rpc_received");
    assert.ok(rpcReceived.length >= 3, "rpc_received records present");
    for (const record of rpcReceived) {
      assert.equal(typeof record.request_id, "string", "rpc_received.request_id is string");
      assert.equal(typeof record.http_method, "string", "rpc_received.http_method is string");
      assert.equal(record.path, "/mcp", "rpc_received.path");
      assert.equal(typeof record.kind, "string", "rpc_received.kind is string");
      assert.equal(typeof record.raw_bytes, "number", "rpc_received.raw_bytes is number");
    }

    // Single ping rpc_received with stable method summary.
    {
      const ping = rpcReceived.find((r) => r.kind === "single" && r.method === "ping");
      assert.ok(ping, "single ping rpc_received present");
      assert.equal(ping.has_rpc_id, true, "ping has_rpc_id");
      assert.equal(ping.rpc_id_type, "number", "ping rpc_id_type");
    }

    // Unknown method still audited as a received single request.
    {
      const unknown = rpcReceived.find((r) => r.kind === "single" && r.method === "unknown/test");
      assert.ok(unknown, "unknown method rpc_received present");
    }

    // Parse-error record carries kind + error_message (text not asserted).
    {
      const parseError = rpcReceived.find((r) => r.kind === "parse_error");
      assert.ok(parseError, "parse_error rpc_received present");
      assert.equal(typeof parseError.error_message, "string", "parse_error.error_message is string");
    }

    // tools/call audit envelope: start + end for the runtime status tool.
    {
      const start = byEvent("tool_call_start").find((r) => r.tool === "test_mcp_runtime_status");
      assert.ok(start, "tool_call_start record present");
      assert.equal(typeof start.request_id, "string", "tool_call_start.request_id is string");
      assert.equal(start.has_rpc_id, true, "tool_call_start.has_rpc_id");

      const end = byEvent("tool_call_end").find((r) => r.tool === "test_mcp_runtime_status");
      assert.ok(end, "tool_call_end record present");
      assert.equal(end.is_error, false, "tool_call_end.is_error");
      assert.equal(typeof end.duration_ms, "number", "tool_call_end.duration_ms is number");
    }

    // Redaction safety: no secret-bearing strings in the isolated audit log.
    for (const forbidden of FORBIDDEN_STRINGS) {
      assert.ok(
        !rawLog.includes(forbidden),
        `audit log must not contain forbidden string: ${forbidden}`
      );
    }

    console.log("smoke_audit_event_contract ok");
  } catch (error) {
    if (serverOutput) console.error(serverOutput);
    throw error;
  } finally {
    child.kill();
    try {
      fs.rmSync(AUDIT_LOG_PATH, { force: true });
    } catch {}
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
