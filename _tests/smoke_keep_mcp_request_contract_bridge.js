"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { createMcpRuntimeHandlers } = require("../src/runtime/mcp_runtime_handlers");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

function req(body, headers = {}) {
  const request = Readable.from([Buffer.from(JSON.stringify(body), "utf8")]);
  request.method = "POST";
  request.headers = {
    accept: "application/json",
    "content-type": "application/json",
    ...headers,
  };
  return request;
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

function modernBody(method = "server/discover", params = {}) {
  return {
    jsonrpc: "2.0",
    id: 12,
    method,
    params: {
      ...params,
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
}

function modernHeaders(method, extra = {}) {
  return {
    "mcp-protocol-version": "2026-07-28",
    "mcp-method": method,
    ...extra,
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
  assert.ok(audits.some((item) =>
    item.event === "rpc_response_sent" &&
    item.data.status_code === 200 &&
    item.data.response_mode === "json" &&
    item.data.has_result === true &&
    item.data.has_error === false &&
    item.data.has_rpc_id === true &&
    item.data.rpc_id_type === "number" &&
    item.data.response_bytes > 0
  ));

  const modern = res();
  await runtimeHandlers.handleMcp(req(modernBody(), modernHeaders("server/discover")), modern);
  assert.equal(modern.statusCode, 200);
  const modernResult = JSON.parse(modern.body()).result;
  assert.equal(modernResult.resultType, "complete");
  assert.deepEqual(modernResult.supportedVersions, ["2026-07-28"]);
  assert.equal(modernResult.ttlMs, 0);
  assert.equal(modernResult.cacheScope, "private");
  assert.equal(modernResult.serverInfo, undefined);
  assert.equal(modernResult._meta["io.modelcontextprotocol/serverInfo"].name, "mcp-tests-response-shape");
  assert.equal(modernResult._meta["io.modelcontextprotocol/serverInfo"].version, "0.40.0");

  const modernList = res();
  await runtimeHandlers.handleMcp(req(modernBody("tools/list"), modernHeaders("tools/list")), modernList);
  assert.equal(modernList.statusCode, 200);
  const modernListResult = JSON.parse(modernList.body()).result;
  assert.equal(modernListResult.resultType, "complete");
  assert.ok(Array.isArray(modernListResult.tools));
  assert.equal(modernListResult._meta["io.modelcontextprotocol/serverInfo"].name, "mcp-tests-response-shape");

  const missingMethod = res();
  await runtimeHandlers.handleMcp(req(modernBody(), { "mcp-protocol-version": "2026-07-28" }), missingMethod);
  assert.equal(missingMethod.statusCode, 400);
  assert.equal(JSON.parse(missingMethod.body()).error.code, -32020);
  assert.equal(JSON.parse(missingMethod.body()).error.data.reason, "method_header_required");

  const mismatchedMethod = res();
  await runtimeHandlers.handleMcp(req(modernBody(), modernHeaders("tools/list")), mismatchedMethod);
  assert.equal(JSON.parse(mismatchedMethod.body()).error.code, -32020);
  assert.equal(JSON.parse(mismatchedMethod.body()).error.data.reason, "method_header_mismatch");

  const encodedName = res();
  const unicodeToolName = "narzędzie";
  await runtimeHandlers.handleMcp(req(
    modernBody("tools/call", { name: unicodeToolName, arguments: {} }),
    modernHeaders("tools/call", {
      "mcp-name": `=?base64?${Buffer.from(unicodeToolName, "utf8").toString("base64")}?=`,
    })
  ), encodedName);
  assert.notEqual(JSON.parse(encodedName.body()).error.code, -32020);

  const malformedName = res();
  await runtimeHandlers.handleMcp(req(
    modernBody("tools/call", { name: unicodeToolName, arguments: {} }),
    modernHeaders("tools/call", { "mcp-name": "=?base64?not-valid?=" })
  ), malformedName);
  assert.equal(JSON.parse(malformedName.body()).error.code, -32020);
  assert.equal(JSON.parse(malformedName.body()).error.data.reason, "invalid_base64_sentinel");

  const missingCapabilitiesBody = modernBody();
  delete missingCapabilitiesBody.params._meta["io.modelcontextprotocol/clientCapabilities"];
  const missingCapabilities = res();
  await runtimeHandlers.handleMcp(req(missingCapabilitiesBody, modernHeaders("server/discover")), missingCapabilities);
  assert.equal(JSON.parse(missingCapabilities.body()).error.code, -32021);

  const unsupported = res();
  await runtimeHandlers.handleMcp(req(modernBody(), {
    "mcp-protocol-version": "2099-01-01",
    "mcp-method": "server/discover",
  }), unsupported);
  assert.equal(unsupported.statusCode, 400);
  assert.equal(JSON.parse(unsupported.body()).error.code, -32022);
  assert.ok(JSON.parse(unsupported.body()).error.data.supported.includes("2026-07-28"));

  const bad = res();
  await runtimeHandlers.handleMcp(req(discoverBody()), bad);
  assert.equal(bad.statusCode, 400);
  assert.equal(JSON.parse(bad.body()).error.data.reason, "protocol_version_header_required");
  assert.ok(audits.some((item) => item.event === "rpc_protocol_error" && item.data.reason === "protocol_version_header_required"));
  assert.ok(audits.some((item) =>
    item.event === "rpc_response_sent" &&
    item.data.status_code === 400 &&
    item.data.response_mode === "json" &&
    item.data.has_result === false &&
    item.data.has_error === true &&
    item.data.error_code === -32020
  ));
  assert.ok(canon.includes("Request-contract bridge clarification"));

  console.log("smoke_keep_mcp_request_contract_bridge ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
