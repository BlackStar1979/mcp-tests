"use strict";

const assert = require("node:assert/strict");

const { loadOptionalTools } = require("../src/tool_loader");
const { buildDecisionRuntimeContext } = require("../src/runtime/decision_runtime_context_builder");
const { evaluateDecisionRuntimePolicy } = require("../src/runtime/decision_runtime_policy");
const { auditToolDescriptors } = require("../src/descriptor_audit");
const { resolveStructuredFileStoragePaths } = require("../src/runtime/server_bootstrap_runtime");
const {
  AUTHORIZED_MCP_TOOL_NAMES,
  PUBLIC_TOOL_NAMES,
  TOOL_POLICIES,
} = require("../src/tool_policy");

const STRUCTURED_NAMES = [
  "file_inspect",
  "content_stage",
  "file_transform",
  "file_split",
  "file_merge",
  "markdown_inspect",
  "markdown_transform",
];

function load(profile, authRequired) {
  return loadOptionalTools({
    profile,
    authPolicy: { mode: authRequired ? "oauth21" : "none", requiresAuth: authRequired },
    serverProfileConfig: {
      surface: {
        optional_tool_groups: profile === "internal" ? ["public", "authorized"] : ["public"],
        include_memory_tools: profile === "internal",
      },
    },
  });
}

const internal = load("internal", true);
const publicTools = load("public", false);
const internalByName = new Map(internal.map((tool) => [tool.name, tool]));
const publicNames = new Set(publicTools.map((tool) => tool.name));
const internalDescriptors = internal.map((tool) => tool.descriptor);
const publicDescriptors = publicTools.map((tool) => tool.descriptor);

const internalDescriptorAudit = auditToolDescriptors(internalDescriptors, {
  expectedToolNames: internalDescriptors.map((tool) => tool.name),
  annotationMode: "structural",
});
assert.equal(internalDescriptorAudit.ok, true, internalDescriptorAudit.errors.join("; "));

const publicDescriptorAudit = auditToolDescriptors(publicDescriptors, {
  expectedToolNames: publicDescriptors.map((tool) => tool.name),
  annotationMode: "read_only",
});
assert.equal(publicDescriptorAudit.ok, true, publicDescriptorAudit.errors.join("; "));

const malformedDescriptor = {
  ...internalDescriptors[0],
  annotations: { ...internalDescriptors[0].annotations, idempotentHint: "yes" },
};
const malformedAudit = auditToolDescriptors(
  [malformedDescriptor, ...internalDescriptors.slice(1)],
  {
    expectedToolNames: internalDescriptors.map((tool) => tool.name),
    annotationMode: "structural",
  }
);
assert.equal(malformedAudit.ok, false);
assert.match(malformedAudit.errors.join("; "), /idempotentHint must be boolean/);

for (const name of STRUCTURED_NAMES) {
  assert.ok(AUTHORIZED_MCP_TOOL_NAMES.includes(name), `${name} must be authorized`);
  assert.equal(PUBLIC_TOOL_NAMES.includes(name), false, `${name} must not be public`);
  assert.equal(publicNames.has(name), false, `${name} must not load on public surface`);
  const tool = internalByName.get(name);
  assert.ok(tool, `${name} must load on authenticated internal surface`);
  assert.equal(tool.descriptor.inputSchema.additionalProperties, false, `${name} input schema must be closed`);
  assert.equal(tool.descriptor.outputSchema.additionalProperties, false, `${name} output schema must be closed`);
  assert.equal(tool.descriptor.annotations.openWorldHint, false, `${name} must be closed-world`);
  assert.equal(TOOL_POLICIES[name].profile_allowed.includes("internal"), true);
  assert.equal(TOOL_POLICIES[name].auth_required, true);
  assert.equal(TOOL_POLICIES[name].public_safe, false);
  assert.equal(TOOL_POLICIES[name].uses_fs, true);
}

assert.equal(internalByName.get("file_inspect").descriptor.annotations.readOnlyHint, true);
assert.equal(internalByName.get("markdown_inspect").descriptor.annotations.readOnlyHint, true);
assert.equal(internalByName.get("content_stage").descriptor.annotations.readOnlyHint, false);
for (const name of ["content_stage", "file_transform", "file_split", "file_merge", "markdown_transform"]) {
  assert.equal(internalByName.get(name).descriptor.annotations.destructiveHint, false, `${name} is reversible or source-preserving`);
  const decisionContext = buildDecisionRuntimeContext({
    toolName: name,
    args: {},
    authMode: "oauth21",
    profile: "internal",
    getOptionalTool: (toolName) => internalByName.get(toolName),
    requestMeta: { requestId: `structured-${name}` },
  });
  const decision = evaluateDecisionRuntimePolicy({ decisionContext });
  assert.equal(decision.allow, true, `${name} must reach its handler under the authenticated tests profile`);
}

const descriptions = Object.fromEntries(STRUCTURED_NAMES.map((name) => [name, internalByName.get(name).descriptor.description]));
assert.match(descriptions.file_transform, /one file/i);
assert.match(descriptions.file_split, /one physical.*several physical/i);
assert.match(descriptions.file_merge, /several.*physical.*one destination/i);
assert.match(descriptions.markdown_transform, /heading/i);
assert.match(descriptions.content_stage, /bounded calls|does not fit one inline call/i);

const toolsSpec = require("../SERVER_TOOLS_SPEC.json");
const connectorSpec = require("../SERVER_CONNECTOR_SURFACE_SPEC.json");
const resourceSpec = require("../SERVER_RESOURCE_POLICY_SPEC.json");
const runtimeSpec = require("../SERVER_RUNTIME_CONFIG_SPEC.json");
const databaseSpec = require("../SERVER_DATABASE_POLICY_SPEC.json");
const eventSpec = require("../SERVER_EVENT_CATALOG_SPEC.json");
for (const name of STRUCTURED_NAMES) {
  assert.ok(toolsSpec.tool_catalog[name], `tool catalog missing ${name}`);
  assert.ok(connectorSpec.authenticated_connector.expected_authorized_tools.includes(name));
  assert.equal(connectorSpec.public_connector.forbidden_tool_names.includes(name), true);
}
assert.equal(toolsSpec.total_mcp_callable_tool_count, 98);
assert.equal(connectorSpec.authenticated_connector.expected_public_plus_authorized_count, 98);
assert.ok(resourceSpec.resource_classes.filesystem_workspace_structured_mutation);
assert.ok(resourceSpec.resource_classes.filesystem_workspace_structured_readonly);
assert.equal(runtimeSpec.restart_supervisor.structured_file_mutation.content_stage_storage_env, "MCP_CONTENT_STAGE_STORAGE_FILE");
assert.equal(runtimeSpec.restart_supervisor.structured_file_mutation.compose_storage_env, "MCP_FILE_COMPOSE_STORAGE_FILE");
assert.ok(databaseSpec.database_scopes.content_stage_store);
assert.ok(databaseSpec.database_scopes.file_compose_journal);
const eventNames = new Set(eventSpec.events.map((event) => event.name));
for (const name of [
  "content_stage_created",
  "content_stage_chunk_appended",
  "content_stage_sealed",
  "content_stage_released",
  "content_stages_pruned",
  "file_compose_operation_started",
  "file_compose_operation_prepared",
  "file_compose_operation_committed",
  "file_compose_operation_rolled_back",
  "file_compose_operation_recovery_failed",
]) {
  assert.equal(eventNames.has(name), true, `event catalog missing ${name}`);
}

const firstPortPaths = resolveStructuredFileStoragePaths({ env: {}, port: 3101 });
const secondPortPaths = resolveStructuredFileStoragePaths({ env: {}, port: 3102 });
assert.notEqual(firstPortPaths.contentStageStorageFile, secondPortPaths.contentStageStorageFile);
assert.notEqual(firstPortPaths.fileComposeStorageFile, secondPortPaths.fileComposeStorageFile);
assert.match(firstPortPaths.contentStageStorageFile, /tests_content_stages_3101\.sqlite$/);
assert.match(firstPortPaths.fileComposeStorageFile, /tests_file_compose_3101\.sqlite$/);
assert.deepEqual(
  resolveStructuredFileStoragePaths({
    env: {
      MCP_CONTENT_STAGE_STORAGE_FILE: "C:/tmp/custom-stage.sqlite",
      MCP_FILE_COMPOSE_STORAGE_FILE: "C:/tmp/custom-compose.sqlite",
    },
    port: 3103,
  }),
  {
    contentStageStorageFile: "C:/tmp/custom-stage.sqlite",
    fileComposeStorageFile: "C:/tmp/custom-compose.sqlite",
  }
);

console.log("smoke_structured_file_runtime_integration ok");
