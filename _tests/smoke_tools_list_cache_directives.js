"use strict";
const assert = require("node:assert/strict");
const { buildToolSurfaceFingerprint } = require("../src/schema_compat");
const { buildToolsListResponse } = require("../src/runtime/tools_list_response");
const { handleToolsListMessage } = require("../src/runtime/tools_list_message_handler");
const { handleInitializeMessage } = require("../src/runtime/initialize_message_handler");
const { buildRuntimeStatus } = require("../src/runtime_status");

const tools = [
  { name: "alpha", title: "Alpha", description: "Alpha tool", inputSchema: { type: "object", properties: {} }, outputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "beta", title: "Beta", description: "Beta tool", inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] }, outputSchema: { type: "object", properties: {}, additionalProperties: false } },
];
const serverStartId = "2026-06-27T12:00:00.000Z";
const fingerprint = buildToolSurfaceFingerprint(tools);

const list = buildToolsListResponse(tools, { authMode: "oauth21", serverStartId });
assert.equal(list.ttlMs, 0);
assert.equal(list.cacheScope, "private");
assert.equal(list._meta["mcp-tests/toolSurfaceFingerprint"], fingerprint.combined_fingerprint);
assert.equal(list._meta["mcp-tests/toolNamesHash"], fingerprint.tool_names_hash);
assert.equal(list._meta["mcp-tests/toolSurfaceCount"], 2);
assert.equal(list._meta["mcp-tests/serverStartId"], serverStartId);
assert.equal(list.tools[0]._meta.securitySchemes[0].type, "oauth2");

const audit = [];
const toolsListRpc = handleToolsListMessage(2, tools, {
  authMode: "oauth21",
  serverStartId,
  requestId: "req-tools-list",
  sessionId: "session-a",
  auditLog(event, data) { audit.push({ event, data }); },
});
assert.equal(toolsListRpc.result.ttlMs, 0);
assert.ok(audit.some((entry) => entry.event === "tools_list_served" && entry.data.fingerprint === fingerprint.combined_fingerprint && entry.data.server_start_id === serverStartId));
assert.ok(audit.some((entry) => entry.event === "tools_list_cache_directive" && entry.data.ttl_ms === 0 && entry.data.cache_scope === "private"));

const initAudit = [];
const init = handleInitializeMessage({
  id: 1,
  params: { protocolVersion: "2025-06-18", clientInfo: { name: "smoke-client", version: "1" }, capabilities: {} },
  serverName: "server",
  serverVersion: "0.0.0",
  connectorShapeVersion: "shape",
  outputMode: "structured",
  authMode: "oauth21",
  profile: "internal",
  tools,
  serverStartId,
  requestId: "req-init",
  sessionId: "session-a",
  auditLog(event, data) { initAudit.push({ event, data }); },
});
assert.equal(init.result.serverInfo.serverStartId, serverStartId);
assert.equal(init.result.capabilities.tools.listChanged, false);
assert.ok(initAudit.some((entry) => entry.event === "initialize_received" && entry.data.server_start_id === serverStartId && entry.data.client_name === "smoke-client"));

const status = buildRuntimeStatus({
  serverName: "server",
  serverVersion: "0.0.0",
  connectorShapeVersion: "shape",
  outputMode: "structured",
  publicBaseUrl: "https://example.test",
  host: "127.0.0.1",
  port: 3008,
  authPolicy: { mode: "oauth21", status: () => ({ mode: "oauth21", enabled: true, requires_auth: true }) },
  auditVersion: "audit-v1",
  auditLogPath: "audit.jsonl",
  maxFetchTextChars: 2500,
  stageStatus: "stage",
  securityBoundary: () => ({ status: "ok" }),
  profile: "internal",
  profilePolicy: () => ({ ok: true }),
  toolPolicySummary: () => [],
  enabledTools: () => tools.map((tool) => tool.name),
  toolSurfaceFingerprint: () => fingerprint,
  schemaCompatibility: () => ({ success: true, status: "ok", tool_count: 2, error_count: 0, warning_count: 0, schema_fingerprint: "schema" }),
  runtimeIdentity: () => ({ server_name: "server" }),
  toolLabels: () => ({ version: "labels", public: [], internal: [], plugins: [] }),
  network: { envFlagEnabled: () => false, getAllowedDomains: () => [], getTimeoutMs: () => 0, getMaxBytes: () => 0 },
  fs: { envFlagEnabled: () => false, getPublicFsRoot: () => "", getPublicFsMaxFileBytes: () => 0, getPublicFsMaxTextChars: () => 0, getPublicFsMaxListEntries: () => 0 },
  serverStartId,
});
assert.equal(status.server_start_id, serverStartId);
assert.equal(status.compatibility_label, "stage");
console.log("smoke_tools_list_cache_directives ok");
