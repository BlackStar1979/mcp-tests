"use strict";

const assert = require("node:assert/strict");

const { loadOptionalTools } = require("../../src/tool_loader");
const { getToolPolicy } = require("../../src/tool_policy");

const EXPECTED = [
  "list_remote_site_files",
  "read_remote_site_file",
  "remote_site_runtime_status",
  "preview_remote_site_retention",
];

(() => {
  const tools = loadOptionalTools({
    profile: "internal",
    authPolicy: { mode: "oauth21", requiresAuth: true },
    serverProfileConfig: {
      surface: {
        optional_tool_groups: ["authorized"],
        include_memory_tools: false,
      },
    },
    createRuntimeStatusTool: () => ({ name: "test_mcp_runtime_status", descriptor: { name: "test_mcp_runtime_status" }, execute: async () => ({}) }),
    createObservabilityStatusTool: () => ({ name: "observability_status", descriptor: { name: "observability_status" }, execute: async () => ({}) }),
    createRuntimeRegistryContext: () => ({}),
  });

  const names = new Set(tools.map((tool) => tool.name));
  for (const name of EXPECTED) {
    assert.equal(names.has(name), true, `missing tool: ${name}`);
    const policy = getToolPolicy(name);
    assert.ok(policy, `missing policy: ${name}`);
    assert.equal(policy.auth_required, true, `${name} must require auth`);
    assert.equal(policy.public_safe, false, `${name} must remain non-public`);
  }

  console.log("smoke_remote_site_tool_registration ok");
})();
