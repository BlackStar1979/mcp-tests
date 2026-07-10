"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const toolsSpec = JSON.parse(fs.readFileSync(path.join(ROOT, "SERVER_TOOLS_SPEC.json"), "utf8"));
const toolPolicy = require("../src/tool_policy");
const authorized = toolsSpec.surface_classes.authorized_mcp_tools.tools;
const internal = toolsSpec.surface_classes.internal_runtime_tools.tools;

assert.ok(Array.isArray(authorized));
assert.ok(Array.isArray(internal));
assert.equal(authorized.length, toolPolicy.AUTHORIZED_MCP_TOOL_NAMES.length);
assert.equal(internal.length, toolPolicy.INTERNAL_RUNTIME_TOOL_NAMES.length);
assert.deepEqual(authorized.slice().sort(), toolPolicy.AUTHORIZED_MCP_TOOL_NAMES.slice().sort());
assert.deepEqual(internal.slice().sort(), toolPolicy.INTERNAL_RUNTIME_TOOL_NAMES.slice().sort());

const loader = fs.readFileSync(path.join(ROOT, "src", "tool_loader.js"), "utf8");
assert.ok(loader.includes("groupEnabled(\"authorized\")"));
assert.equal(loader.includes("groupEnabled(\"internal\")"), false);

const testsProfile = JSON.parse(fs.readFileSync(path.join(ROOT, "profiles", "tests.json"), "utf8"));
assert.deepEqual(testsProfile.surfaces.authenticated.optional_tool_groups, ["public", "authorized", "internal"]);
const publicProfile = JSON.parse(fs.readFileSync(path.join(ROOT, "profiles", "public.json"), "utf8"));
assert.deepEqual(publicProfile.surfaces.public.optional_tool_groups, ["public"]);

const { loadOptionalTools } = require("../src/tool_loader");
const { createRuntimeSupportAssembly } = require("../src/runtime/runtime_support_assembly");
const { CONNECTOR_SHAPE_VERSION, SERVER_NAME, SERVER_VERSION, AUDIT_VERSION } = require("../src/runtime/identity");

const optionalTools = [];
const support = createRuntimeSupportAssembly({
  auditLogPath: path.join(ROOT, "_logs", ".authorized-split-test.jsonl"),
  auditVersion: AUDIT_VERSION,
  serverName: SERVER_NAME,
  serverVersion: SERVER_VERSION,
  connectorShapeVersion: CONNECTOR_SHAPE_VERSION,
  docs: [],
  publicBaseUrl: "http://127.0.0.1:3008",
  maxFetchTextChars: 2500,
  outputMode: "structured",
  optionalTools,
  rootDir: ROOT,
});

const tools = loadOptionalTools({
  profile: "internal",
  authPolicy: { mode: "oauth21", requiresAuth: true },
  serverProfileConfig: { surface: testsProfile.surfaces.authenticated },
  createRuntimeRegistryContext: (label) => support.registryContext({ label }),
});

for (const name of authorized) {
  assert.ok(tools.some((tool) => tool.name === name), `missing loaded authorized tool ${name}`);
}
for (const name of internal) {
  assert.equal(tools.some((tool) => tool.name === name), false, `internal runtime tool must not be MCP-visible: ${name}`);
}

console.log("smoke_authorized_internal_facade_split ok");
