"use strict";

const assert = require("node:assert/strict");
const { createMcpRuntimeHandlers } = require("../src/runtime/mcp_runtime_handlers");
const { normalizeSessionId } = require("../src/runtime/session_tracker");

const audits = [];
function auditLog(event, payload) { audits.push({ event, payload }); }
function toolsList() { return []; }
function getOptionalTool() { return null; }

const runtime = createMcpRuntimeHandlers({
  serverName: "test",
  serverVersion: "0",
  connectorShapeVersion: "shape",
  outputMode: "structured",
  authPolicy: { mode: "none" },
  runtimeProfile: "public",
  toolsList,
  documentRuntimeContext: () => ({ docs: [] }),
  auditLog,
  getOptionalTool,
  publicBaseUrl: "http://127.0.0.1/mcp",
});

(async () => {
  assert.equal(normalizeSessionId("abc-123"), "abc-123");
  assert.equal(normalizeSessionId("bad space"), null);
  assert.equal(normalizeSessionId(undefined), undefined);

  const first = await runtime.handleRpcMessage({ jsonrpc: "2.0", id: 1, method: "ping", params: {} }, { requestId: "r1", sessionId: "s1" });
  assert.deepEqual(first.result, {});
  const replay = await runtime.handleRpcMessage({ jsonrpc: "2.0", id: 1, method: "ping", params: {} }, { requestId: "r2", sessionId: "s1" });
  assert.equal(replay.error.code, -32600);
  assert.equal(replay.error.data.reason, "request_id_reused");

  const otherSession = await runtime.handleRpcMessage({ jsonrpc: "2.0", id: 1, method: "ping", params: {} }, { requestId: "r3", sessionId: "s2" });
  assert.deepEqual(otherSession.result, {});

  const noSessionA = await runtime.handleRpcMessage({ jsonrpc: "2.0", id: 7, method: "ping", params: {} }, { requestId: "r4" });
  const noSessionB = await runtime.handleRpcMessage({ jsonrpc: "2.0", id: 7, method: "ping", params: {} }, { requestId: "r5" });
  assert.deepEqual(noSessionA.result, {});
  assert.deepEqual(noSessionB.result, {});

  assert.ok(audits.some((entry) => entry.event === "rpc_protocol_error" && entry.payload.reason === "request_id_reused"));
  console.log("smoke_stage12_session_replay_guards ok");
})().catch((error) => { console.error(error?.stack || error); process.exit(1); });
