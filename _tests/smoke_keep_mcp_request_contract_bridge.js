"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createMcpRuntimeHandlers } = require("../src/runtime/mcp_runtime_handlers");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

function req(body, headers = {}) {
  return {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...headers,
    },
    on() {},
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(JSON.stringify(body), "utf8");
    },
  };
}

function res() {
  return {
    statusCode: null,
    headers: {},
    chunks: [],
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    writeHead(code, headers) {
      this.statusCode = code;
      for (const [name, value] of Object.entries(headers || {})) this.headers[String(name).toLowerCase()] = value;
    },
    write(chunk) { this.chunks.push(String(chunk)); },
    end(chunk) { if (chunk) this.chunks.push(String(chunk)); },
    body() { return this.chunks.join(""); },
  };
}

function discoverBody(version = "2025-06-18") {
  return {
    jsonrpc: "2.0",
    id: 11,
    method: "server/discover",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": version,
        "io.modelcontextprotocol/clientInfo": { name: "bridge-smoke", version: "1.0.0" },
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
}

(async () => {
  const record = read("_workflow/operator_decisions/keep_mcp_request_contract_bridge.md");
  const state = readJson("_workflow/state.json");
  const inventory = readJson("_workflow/sessionless_inventory.json");
  const runtimeSpec = readJson("SERVER_RUNTIME_CONFIG_SPEC.json");
  const canon = read("_workflow/WORKFLOW_CANON.md");
  const audits = [];
  const auditLog = (event, data) => audits.push({ event, data });
  const runtimeHandlers = createMcpRuntimeHandlers({
    serverName: "mcp-tests-response-shape",
    serverVersion: "0.40.0",
    connectorShapeVersion: "2025-05-strict-v1",
    outputMode: "structured",
    authPolicy: { mode: "none", authenticate: () => ({ ok: true, mode: "none" }) },
    runtimeProfile: "public",
    toolsList: () => [],
    documentRuntimeContext: null,
    auditLog,
    getOptionalTool: () => null,
    publicBaseUrl: "http://127.0.0.1/mcp",
    rateLimiter: null,
    serverStartId: "start-bridge",
    listChangedNotifier: { enabled: false },
  });

  assert.ok(record.includes("Status: GREEN / ADDITIVE REQUEST-CONTRACT BRIDGE APPLIED / HYBRID TRANSITION"));
  assert.equal(state.active_target_direction.request_contract_bridge_record, "_workflow/operator_decisions/keep_mcp_request_contract_bridge.md");
  assert.equal(state.active_target_direction.stable_server_discover_supported, true);
  assert.equal(inventory.active_target_contract.request_contract_bridge_record, "_workflow/operator_decisions/keep_mcp_request_contract_bridge.md");
  assert.equal(inventory.active_target_contract.stable_server_discover_supported, true);
  assert.equal(runtimeSpec.stable_mcp_request_contract_bridge.server_discover_supported, true);
  assert.equal(runtimeSpec.stable_mcp_request_contract_bridge.server_discover_requires_per_request_metadata, true);
  assert.equal(runtimeSpec.stable_mcp_request_contract_bridge.legacy_initialize_still_supported, true);
  const good = res();
  await runtimeHandlers.handleMcp(req(discoverBody(), { "mcp-protocol-version": "2025-06-18" }), good);

  assert.equal(good.statusCode, 200);
  const goodBody = JSON.parse(good.body());
  assert.deepEqual(goodBody.result.supportedVersions, ["2025-06-18"]);
  assert.equal(goodBody.result.protocolVersion, "2025-06-18");
  assert.equal(goodBody.result.transport.route, "/mcp");
  assert.equal(goodBody.result.transport.legacy_initialize_supported, true);

  const bad = res();
  await runtimeHandlers.handleMcp(req(discoverBody()), bad);
  assert.equal(bad.statusCode, 400);
  assert.equal(JSON.parse(bad.body()).error.data.reason, "protocol_version_header_required");
  assert.ok(audits.some((item) => item.event === "rpc_protocol_error" && item.data.reason === "protocol_version_header_required"));
  assert.ok(canon.includes("Request-contract bridge clarification"));
  assert.equal(canon.includes("Next recommended action: prepare the bounded request-contract migration package"), false);
  assert.ok(canon.includes("Next recommended action: use `_workflow/operator_decisions/keep_mcp_transport_session_retirement_package.md` together with `_workflow/operator_decisions/single_route_no_sse_migration_debt_inventory.md`"));

  console.log("smoke_keep_mcp_request_contract_bridge ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
