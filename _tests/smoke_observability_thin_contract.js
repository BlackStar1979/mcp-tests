"use strict";

const assert = require("node:assert/strict");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { OBSERVABILITY_STATUS_OUTPUT_SCHEMA } = require("../src/schemas/observability_tools");
const { assertMatchesSchema } = require("../src/output_schema_guard");

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

async function waitHealth(port) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return;
    } catch {}
    await wait(100);
  }
  throw new Error("health timeout");
}

async function withMcpUrl(callback) {
  if (process.env.MCP_TEST_SMOKE_URL) {
    return callback(process.env.MCP_TEST_SMOKE_URL);
  }

  const port = await getFreePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      MCP_TEST_PORT: String(port),
      MCP_TEST_AUTH_MODE: "none",
      MCP_TEST_FS_ROOT: path.join(__dirname, "..", "_public_sandbox"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitHealth(port);
    return await callback(`http://127.0.0.1:${port}/mcp`);
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
}

async function rpc(mcpUrl, method, params = {}) {
  const response = await fetch(mcpUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: `${method}-${Date.now()}`, method, params }),
  });
  assert.equal(response.status, 200, `${method} HTTP status`);
  return response.json();
}

async function callTool(mcpUrl, name, args = {}) {
  const json = await rpc(mcpUrl, "tools/call", { name, arguments: args });
  assert.ok(json.result, `${name} must return result`);
  const text = json.result?.content?.[0]?.text || "";
  assert.ok(text, `${name} must return content[0].text`);
  return JSON.parse(text);
}

(async () => {
  await withMcpUrl(async (mcpUrl) => {
    const listed = await rpc(mcpUrl, "tools/list", {});
    const toolNames = (listed.result?.tools || []).map((tool) => tool.name);
    assert.ok(toolNames.length > 0);
    if (!toolNames.includes("observability_status")) {
      assert.equal(Boolean(process.env.MCP_TEST_SMOKE_URL), false, "observability_status may be absent only in the standalone local-public fallback");
      return;
    }

    const status = await callTool(mcpUrl, "observability_status", {
      window_size: 800,
      slow_ms: 1000,
      top_n: 20,
      connector_visible_tools: toolNames,
    });

    assertMatchesSchema(status, OBSERVABILITY_STATUS_OUTPUT_SCHEMA, "observability thin contract");

    assert.equal(typeof status.success, "boolean");
    assert.equal(status.mode, "observability-status");
    assert.equal(status.observability_version, "test-mcp-observability-v1");
    assert.equal(status.read_only, true);
    assert.equal(status.mutates_auth, false);
    assert.equal(status.mutates_tools_list, false);

    if (status.runtime.server_version !== undefined) {
      assert.equal(status.runtime.server_version, "0.40.0");
    }
    assert.ok(status.runtime && typeof status.runtime === "object");
    if (status.runtime.auth_mode !== undefined) {
      assert.equal(typeof status.runtime.auth_mode, "string");
    }
    if (status.runtime.profile !== undefined) {
      assert.equal(typeof status.runtime.profile, "string");
    }
    if (status.runtime.enabled_tool_count !== undefined) {
      assert.equal(status.runtime.enabled_tool_count, toolNames.length);
    }

    if (status.audit_log) {
      if (status.audit_log.path_disclosed !== undefined) {
        assert.equal(status.audit_log.path_disclosed, false);
      }
    }
    if (status.audit_jsonl_health) {
      if (status.audit_jsonl_health.status !== undefined) {
        assert.equal(typeof status.audit_jsonl_health.status, "string");
      }
      if (status.audit_jsonl_health.parse_errors !== undefined) {
        assert.ok(status.audit_jsonl_health.parse_errors >= 0);
      }
    }

    assert.ok(status.connector_map && typeof status.connector_map === "object");
    if (status.connector_map.comparison_available === true) {
      assert.equal(status.connector_map.status, "in_sync");
      assert.equal(status.connector_map.refresh_recommended, false);
    }
    if (status.connector_map_health) {
      if (status.connector_map_health.status !== undefined) {
        assert.equal(typeof status.connector_map_health.status, "string");
      }
      if (status.connector_map_health.refresh_recommended !== undefined) {
        assert.equal(typeof status.connector_map_health.refresh_recommended, "boolean");
      }
    }

    if (status.events?.tool_call_error_count !== undefined) {
      assert.equal(typeof status.events.tool_call_error_count, "number");
      assert.ok(status.events.tool_call_error_count >= 0);
    }
    if (status.transport_runtime_signals?.server_error_count !== undefined) {
      assert.equal(typeof status.transport_runtime_signals.server_error_count, "number");
      assert.ok(status.transport_runtime_signals.server_error_count >= 0);
    }
    if (status.latency?.delayed_response_count !== undefined) {
      assert.equal(typeof status.latency.delayed_response_count, "number");
      assert.ok(status.latency.delayed_response_count >= 0);
    }
  });

  console.log("smoke_observability_thin_contract ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
