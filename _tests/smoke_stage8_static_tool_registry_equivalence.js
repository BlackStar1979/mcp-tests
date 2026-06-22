"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { createStaticToolRegistry } = require("../src/static_tool_registry");
const { loadOptionalTools } = require("../src/tool_loader");
const { createRuntimeSupportAssembly } = require("../src/runtime/runtime_support_assembly");
const { buildCoreToolDescriptors } = require("../src/runtime/core_tool_descriptors");
const { loadServerProfileConfig } = require("../src/server_profile_loader");
const { createTestMcpRuntimeStatusTool } = require("../tools/authorized/test_mcp_runtime_status");
const { createObservabilityStatusTool } = require("../tools/authorized/observability_status");
const { CONNECTOR_SHAPE_VERSION, SERVER_NAME, SERVER_VERSION, AUDIT_VERSION } = require("../src/runtime/identity");

const ROOT = path.resolve(__dirname, "..");

function runtimeStatusProvider() {
  return {
    server: { name: SERVER_NAME, version: SERVER_VERSION },
    runtime: { auth: { mode: "oauth21" }, profile: { mode: "internal" } },
  };
}

function makeDynamicTools() {
  return {
    createRuntimeStatusTool: () => createTestMcpRuntimeStatusTool(runtimeStatusProvider),
    createObservabilityStatusTool: () => createObservabilityStatusTool({
      runtimeStatusProvider,
      auditLogPath: path.join(ROOT, "_logs", ".stage8-static-registry-smoke.jsonl"),
    }),
  };
}

function buildScenario({ profileName, authMode }) {
  const authRequired = authMode !== "none";
  const runtimeProfile = authRequired ? "internal" : "public";
  const serverProfileConfig = loadServerProfileConfig({ profileName, authMode, rootDir: ROOT });
  const dynamicTools = makeDynamicTools();
  const optionalTools = loadOptionalTools({
    profile: runtimeProfile,
    authPolicy: { mode: authMode, requiresAuth: authRequired },
    serverProfileConfig,
    ...dynamicTools,
  });
  const coreDescriptors = buildCoreToolDescriptors({
    connectorShapeVersion: CONNECTOR_SHAPE_VERSION,
    outputMode: "structured",
    maxFetchTextChars: 2500,
  });
  const directDescriptors = coreDescriptors.concat(optionalTools.map((tool) => tool.descriptor));
  const registry = createStaticToolRegistry({
    coreDescriptors,
    optionalTools,
    metadata: { profileName, authMode, runtimeProfile },
  });
  const support = createRuntimeSupportAssembly({
    auditLogPath: path.join(ROOT, "_logs", ".stage8-static-registry-smoke-runtime.jsonl"),
    auditVersion: AUDIT_VERSION,
    serverName: SERVER_NAME,
    serverVersion: SERVER_VERSION,
    connectorShapeVersion: CONNECTOR_SHAPE_VERSION,
    docs: [],
    publicBaseUrl: "http://127.0.0.1:3009",
    maxFetchTextChars: 2500,
    outputMode: "structured",
    optionalTools,
  });

  return { optionalTools, coreDescriptors, directDescriptors, registry, runtimeDescriptors: support.toolsList() };
}

function assertEquivalentScenario(label, scenario, expected) {
  assert.deepEqual(scenario.registry.descriptors(), scenario.directDescriptors, `${label} registry descriptors must equal direct descriptors`);
  assert.deepEqual(scenario.runtimeDescriptors, scenario.directDescriptors, `${label} runtime_support_assembly must remain equivalent`);
  assert.deepEqual(scenario.registry.names(), scenario.directDescriptors.map((tool) => tool.name), `${label} registry names must preserve order`);
  const snapshot = scenario.registry.snapshot();
  assert.equal(snapshot.tool_count, expected.total, `${label} total count`);
  assert.equal(snapshot.core_tool_count, 2, `${label} core count`);
  assert.equal(snapshot.optional_tool_count, expected.optional, `${label} optional count`);
  assert.equal(scenario.registry.getDescriptor("search")?.name, "search", `${label} core lookup`);
  if (expected.optional > 0) {
    const firstOptional = scenario.optionalTools[0];
    assert.equal(scenario.registry.getTool(firstOptional.name), firstOptional, `${label} optional tool lookup`);
  }
}

(() => {
  const publicScenario = buildScenario({ profileName: "tests", authMode: "none" });
  assertEquivalentScenario("public", publicScenario, { total: 13, optional: 11 });

  const authorizedScenario = buildScenario({ profileName: "tests", authMode: "oauth21" });
  assertEquivalentScenario("authorized", authorizedScenario, { total: 43, optional: 41 });

  assert.throws(() => createStaticToolRegistry({
    coreDescriptors: [{ name: "dup" }, { name: "dup" }],
  }), /missing matching descriptor|Duplicate static registry tool/);

  console.log("smoke_stage8_static_tool_registry_equivalence ok");
})();
