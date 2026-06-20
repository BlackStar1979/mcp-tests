const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const step36Id = "stage12_step36_policy_runtime_spec_closeout";
const step36bId = "stage12_step36b_post_refresh_runtime_evidence_status_semantics";
const step36bLabel = "Stage 12 / Step 36B - Post-refresh Runtime Evidence and Status Semantics Reconciliation";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const policyRuntime = readJson("SERVER_POLICY_RUNTIME_SPEC.json");
assert.equal(policyRuntime.runtime_enforced, false, "policy runtime spec must remain non-enforced");
assert.equal(policyRuntime.connector_visible, false, "policy runtime spec must remain non-connector-visible");
assert.equal(policyRuntime.no_cli_extension, true, "policy runtime spec must not introduce CLI extension");

const manifest = readJson("_tests/run_all_smoke_scripts.json");
assert.ok(manifest.includes("_tests/smoke_stage12_step36b_post_refresh_runtime_semantics.js"), "manifest must include Step 36B smoke");

const state = readJson("_workflow/state.json");
const currentId = state.current_work_package && state.current_work_package.id;
const previousId = state.previous_work_package && state.previous_work_package.id;
const completed = Array.isArray(state.completed_work_packages) ? state.completed_work_packages : [];
const completedStep36b = completed.find((item) => item && item.id === step36bId);
assert.ok(
  currentId === step36bId || previousId === step36bId || Boolean(completedStep36b),
  "Step 36B must remain current or be preserved as previous after later work packages",
);
const step36b = currentId === step36bId ? state.current_work_package : previousId === step36bId ? state.previous_work_package : completedStep36b;
assert.equal(step36b.id, step36bId);
assert.equal(step36b.label, step36bLabel);
assert.equal(step36b.status, "frozen");
assert.equal(step36b.previous, step36Id);
assert.equal(step36b.connector_visible_change, false);
assert.equal(step36b.runtime_code_changed, false);
assert.equal(step36b.runtime_process_restart, false);
assert.equal(step36b.acceptance.frozen_without_unfinished_items, true);
assert.equal(step36b.acceptance.gpt_mcp_identified_as_repo_operation_channel_only, true);
assert.equal(step36b.acceptance.test_mcp_public_connector_verified, true);
assert.equal(step36b.acceptance.test_mcp_bearer_runtime_verified, true);
assert.equal(step36b.acceptance.policy_runtime_spec_non_enforced, true);
assert.equal(step36b.acceptance.policy_runtime_spec_connector_invisible, true);
assert.equal(step36b.acceptance.policy_runtime_spec_no_cli_extension, true);
assert.equal(step36b.acceptance.runtime_enforcement_implemented, false);
assert.equal(step36b.acceptance.connector_visible_change_performed, false);
assert.equal(step36b.acceptance.auth_config_changed, false);

const truth = step36b.post_refresh_live_runtime_truth;
assert.equal(truth.gpt_mcp_role, "repo operation channel only; not the restarted TEST MCP runtime");
assert.equal(truth.test_mcp.connector, "TEST_MCP");
assert.equal(truth.test_mcp.public_tool_count, 13);
assert.equal(truth.test_mcp.verified_call, "fs_list_public");
assert.equal(truth.test_mcp.result, "success");
assert.equal(truth.test_mcp_bearer.connector, "TEST_MCP_BEARER");
assert.equal(truth.test_mcp_bearer.auth_mode, "bearer");
assert.equal(truth.test_mcp_bearer.profile, "internal");
assert.equal(truth.test_mcp_bearer.enabled_tool_count, 46);
assert.equal(truth.test_mcp_bearer.tool_names_hash, "f47c9460e21079a8");
assert.equal(truth.test_mcp_bearer.schema_compatibility, "ok");
assert.equal(truth.test_mcp_bearer.security_boundary, "ok");
assert.equal(truth.status_semantics.live_bearer_truth_source, "TEST_MCP_BEARER.test_mcp_runtime_status");
assert.ok(truth.status_semantics.guard_tools_current_auth_mode_none_scope.includes("not the live bearer runtime truth source"));
assert.equal(truth.status_semantics.runtime_stage_status_semantics, "runtime-compatibility-label-not-repo-progress-label");
assert.equal(truth.policy_runtime.runtime_enforced, false);
assert.equal(truth.policy_runtime.connector_visible, false);
assert.equal(truth.policy_runtime.no_cli_extension, true);

assert.equal(state.last_validation.stage12_step36b_post_refresh_runtime_semantics, "ok");
assert.equal(state.last_validation.post_restart_connector_refresh, "ok_test_mcp_and_test_mcp_bearer");

const handoff = readText("_workflow/NEXT_CHAT_HANDOFF.md");
const course = readText("_workflow/WORKING_COURSE.md");
for (const text of [handoff, course]) {
  assert.ok(text.includes("_workflow/state.json"), "workflow docs must cite state source");
  assert.ok(text.includes(step36bId), "workflow docs must mention Step 36B id");
  assert.ok(text.includes(step36bLabel), "workflow docs must mention Step 36B label");
  assert.ok(text.includes("TEST_MCP"), "workflow docs must mention TEST_MCP");
  assert.ok(text.includes("TEST_MCP_BEARER"), "workflow docs must mention TEST_MCP_BEARER");
  assert.ok(text.includes("GPT_MCP is the repository operation channel only"), "workflow docs must not treat GPT_MCP as test runtime");
  assert.ok(text.includes("current_auth_mode=none"), "workflow docs must document guard status semantics debt");
  assert.ok(text.includes("runtime-compatibility-label-not-repo-progress-label"), "workflow docs must document runtime stage label semantics");
  assert.ok(text.includes("runtime_enforced=false"), "workflow docs must preserve policy runtime non-enforcement");
  assert.ok(text.includes("connector_visible=false"), "workflow docs must preserve policy runtime non-visibility");
  assert.ok(text.includes("Stage 12 / Step 37"), "workflow docs must mention Step 37 lineage");
}

console.log("smoke_stage12_step36b_post_refresh_runtime_semantics ok");
