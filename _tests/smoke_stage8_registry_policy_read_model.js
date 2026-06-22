"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { createStaticToolRegistry } = require("../src/static_tool_registry");
const { buildRegistryPolicyReadModel, loadServerToolsSpec } = require("../src/registry_policy_read_model");
const { loadOptionalTools } = require("../src/tool_loader");
const { buildCoreToolDescriptors } = require("../src/runtime/core_tool_descriptors");
const { loadServerProfileConfig } = require("../src/server_profile_loader");
const { createTestMcpRuntimeStatusTool } = require("../tools/authorized/test_mcp_runtime_status");
const { createObservabilityStatusTool } = require("../tools/authorized/observability_status");
const { CONNECTOR_SHAPE_VERSION, SERVER_NAME, SERVER_VERSION } = require("../src/runtime/identity");

const ROOT = path.resolve(__dirname, "..");
const toolsSpec = loadServerToolsSpec({ rootDir: ROOT });

function runtimeStatusProvider() {
  return {
    server: { name: SERVER_NAME, version: SERVER_VERSION },
    runtime: { auth: { mode: "oauth21" }, profile: { mode: "internal" } },
  };
}

function buildRegistry({ profileName, authMode }) {
  const authRequired = authMode !== "none";
  const runtimeProfile = authRequired ? "internal" : "public";
  const serverProfileConfig = loadServerProfileConfig({ profileName, authMode, rootDir: ROOT });
  const optionalTools = loadOptionalTools({
    profile: runtimeProfile,
    authPolicy: { mode: authMode, requiresAuth: authRequired },
    serverProfileConfig,
    createRuntimeStatusTool: () => createTestMcpRuntimeStatusTool(runtimeStatusProvider),
    createObservabilityStatusTool: () => createObservabilityStatusTool({
      runtimeStatusProvider,
      auditLogPath: path.join(ROOT, "_logs", ".stage8-registry-policy-read-model.jsonl"),
    }),
  });
  const coreDescriptors = buildCoreToolDescriptors({
    connectorShapeVersion: CONNECTOR_SHAPE_VERSION,
    outputMode: "structured",
    maxFetchTextChars: 2500,
  });
  return createStaticToolRegistry({
    coreDescriptors,
    optionalTools,
    metadata: { profileName, authMode, runtimeProfile },
  });
}

function assertModel(label, model, expected) {
  assert.equal(model.ok, true, `${label} read model must be ok: ${model.errors.join("; ")}`);
  assert.equal(model.tool_count, expected.tool_count, `${label} tool count`);
  const snapshot = model.snapshot({ includeEntries: true });
  assert.equal(snapshot.missing_tool_policy.length, 0, `${label} missing policy`);
  assert.equal(snapshot.missing_catalog_entry.length, 0, `${label} missing catalog`);
  assert.equal(snapshot.entries.length, expected.tool_count, `${label} snapshot entries`);
  for (const name of expected.required) {
    const entry = model.get(name);
    assert.ok(entry, `${label} missing ${name}`);
    assert.equal(entry.descriptor_summary.name, name, `${label} descriptor summary ${name}`);
    assert.equal(entry.catalog_summary.name, name, `${label} catalog summary ${name}`);
    assert.ok(entry.tool_policy_summary, `${label} tool policy summary ${name}`);
  }
}

(() => {
  const publicRegistry = buildRegistry({ profileName: "tests", authMode: "none" });
  const publicModel = buildRegistryPolicyReadModel({ registry: publicRegistry, toolsSpec });
  assertModel("public", publicModel, { tool_count: 13, required: ["search", "fetch", "fs_list_public", "net_http_get_allowlisted"] });
  assert.equal(publicModel.get("search").catalog_summary.surface_class, "public_mcp_tools");
  assert.equal(publicModel.get("fs_list_public").tool_policy_summary.fs_scope, "public-fs-sandbox");

  const authorizedRegistry = buildRegistry({ profileName: "tests", authMode: "oauth21" });
  const authorizedModel = buildRegistryPolicyReadModel({ registry: authorizedRegistry, toolsSpec });
  assertModel("authorized", authorizedModel, {
    tool_count: 43,
    required: ["test_mcp_runtime_status", "auth_legacy_retirement_status", "memory_save", "plugin_visibility_plan"],
  });
  assert.equal(authorizedModel.get("memory_save").catalog_summary.operation_class, "write");
  assert.equal(authorizedModel.get("memory_save").tool_policy_summary.read_only, false);
  assert.equal(authorizedModel.get("auth_legacy_retirement_status").catalog_summary.audit_required, true);

  const badRegistry = createStaticToolRegistry({
    coreDescriptors: [{ name: "unknown_tool", inputSchema: { type: "object" } }],
  });
  const badModel = buildRegistryPolicyReadModel({ registry: badRegistry, toolsSpec });
  assert.equal(badModel.ok, false);
  assert.ok(badModel.snapshot().missing_tool_policy.includes("unknown_tool"));
  assert.ok(badModel.snapshot().missing_catalog_entry.includes("unknown_tool"));

  console.log("smoke_stage8_registry_policy_read_model ok");
})();
