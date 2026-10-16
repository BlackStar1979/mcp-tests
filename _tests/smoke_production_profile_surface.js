"use strict";

// The production profile (LocalNodeMCP) is the tests profile minus the tests-only tools and the
// memory_* tools (moved to the TinyPyMCP shared store). Classification and evidence:
// _workflow/SURFACE_CLASSIFICATION.md. Checked through the real profile loader and tool loader.

const assert = require("node:assert/strict");

const { loadServerProfileConfig } = require("../src/server_profile_loader");
const { loadOptionalTools } = require("../src/tool_loader");

const TESTS_ONLY = [
  "code_sample_js",
  "fs_list_public", "fs_get_public_info", "fs_read_public_text", "fs_read_public_lines", "fs_read_public_chunk",
  "write_remote_site_file", "edit_remote_site_file", "delete_remote_site_file", "move_remote_site_file",
  "restore_remote_site_file", "preview_remote_site_retention",
  "tool_dispatch", "change_workflow_simulator", "deploy_decision_guard",
];
const MEMORY = [
  "memory_save", "memory_search", "memory_get_state", "memory_set_state",
  "memory_create_task", "memory_get_tasks", "memory_update_task",
];
// The work the operator actually does through this server (by audited call volume).
const MUST_STAY = [
  "run_process", "process_start", "process_status", "edit_file_patch", "file_transform", "read_file_lines",
  "read_file", "file_inspect", "cbm_search_code", "build_index", "search_index", "dev_code_locate",
  "project_truth_audit", "list_remote_site_files", "read_remote_site_file", "net_http_get_allowlisted",
];

function surfaceNames(profileName) {
  const previous = process.env.MCP_TEST_PROFILE;
  process.env.MCP_TEST_PROFILE = "internal";
  try {
    const serverProfileConfig = loadServerProfileConfig({ profileName, authMode: "oauth21" });
    return loadOptionalTools({
      profile: "internal",
      authMode: "oauth21",
      authPolicy: { mode: "oauth21", requiresAuth: true },
      serverProfileConfig,
    }).map((tool) => tool.name);
  } finally {
    if (previous === undefined) delete process.env.MCP_TEST_PROFILE;
    else process.env.MCP_TEST_PROFILE = previous;
  }
}

const tests = surfaceNames("tests");
const production = surfaceNames("production");

for (const name of [...TESTS_ONLY, ...MEMORY]) {
  assert.ok(tests.includes(name), `fixture: ${name} is on the tests surface`);
  assert.equal(production.includes(name), false, `${name} must not be on the production surface`);
}
for (const name of MUST_STAY) {
  assert.ok(production.includes(name), `${name} must stay on the production surface`);
}
// Production inherits every OTHER tool of the tests profile: a new tool reaches production unless
// it is excluded on purpose.
assert.deepEqual(
  production.slice().sort(),
  tests.filter((name) => !TESTS_ONLY.includes(name) && !MEMORY.includes(name)).sort()
);

console.log("smoke_production_profile_surface ok");
