"use strict";

const assert = require("node:assert/strict");
const { dispatchRpcMessage } = require("../src/runtime/rpc_message_dispatcher");

(async () => {
  const audits = [];
  const response = await dispatchRpcMessage({
    prelude: { id: 1, method: "server/discover", params: {} },
    context: {
      requestId: "req-1",
      sessionId: "",
      requestMetadata: {
        protocolVersion: "2025-06-18",
        clientInfo: { name: "smoke-client", version: "1.0.0" },
        clientCapabilities: { tools: {} },
      },
    },
    serverName: "mcp-tests-response-shape",
    serverVersion: "0.40.0",
    connectorShapeVersion: "2025-05-strict-v1",
    outputMode: "structured",
    authMode: "oauth21",
    profile: "internal",
    tools: [],
    auditLog: (event, data) => audits.push({ event, data }),
    serverStartId: "start-a",
    disableLegacyInitialize: false,
  });

  assert.equal(response.result.transport.route, "/mcp");
  assert.equal(response.result.transport.legacy_initialize_supported, true);
  const event = audits.find((entry) => entry.event === "server_discover_received");
  assert.ok(event);
  assert.equal(event.data.request_id, "req-1");
  assert.equal(event.data.client_name, "smoke-client");
  assert.equal(event.data.client_version, "1.0.0");
  assert.equal(event.data.protocol_version, "2025-06-18");

  console.log("smoke_server_discover_audit ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
