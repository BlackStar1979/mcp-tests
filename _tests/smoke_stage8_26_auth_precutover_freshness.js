const assert = require("node:assert/strict");
const { getBearerCutoverGuard } = require("../src/auth_bearer_cutover_guard");
const { getAuthTransitionStatus } = require("../src/auth_transition");
const { getModularAuthParityStatus } = require("../src/auth_modular_parity");
const { runBearerDryRun } = require("../src/auth_bearer_dry_run");
const { loadOptionalTools } = require("../src/tool_loader");
const { createTestMcpRuntimeStatusTool } = require("../tools/test_mcp_runtime_status");
const { createObservabilityStatusTool } = require("../tools/observability_status");

const transition = getAuthTransitionStatus();
assert.equal(transition.success, true);
assert.equal(transition.current_auth_mode, "none");
assert.equal(transition.bearer_implementation_present, true);
assert.equal(transition.access_implementation_present, true);
assert.equal(transition.auth_policy_present, true);
assert.equal(transition.bearer_ready_for_dry_run, true);
assert.equal(transition.bearer_ready_for_active_switch, false);
assert.equal(transition.token_file_configured, false);
assert.equal(transition.token_file_path_disclosed, false);
assert.deepEqual(transition.blockers, []);
assert.ok(transition.warnings.includes("active runtime still uses auth.none"));

const parity = getModularAuthParityStatus();
assert.equal(parity.success, true);
assert.equal(parity.access_cloudflare_ready, true);
assert.equal(parity.bearer_header_ready, true);
assert.equal(parity.bearer_query_ready, false);
assert.deepEqual(parity.blockers, []);

const dryRun = runBearerDryRun();
assert.equal(dryRun.success, true);
assert.equal(dryRun.active_auth_mode_before, "none");
assert.equal(dryRun.active_auth_mode_after, "none");
assert.equal(dryRun.missing_rejected_401, true);
assert.equal(dryRun.invalid_rejected_401, true);
assert.equal(dryRun.valid_accepted_200, true);
assert.equal(dryRun.invalid_query_rejected_401, true);
assert.equal(dryRun.valid_query_rejected_401, true);
assert.equal(dryRun.challenge_present, true);
assert.equal(dryRun.temp_token_removed, true);
assert.equal(dryRun.temp_dir_removed, true);
assert.equal(dryRun.token_disclosed, false);
assert.equal(dryRun.token_path_disclosed, false);
assert.deepEqual(dryRun.failures, []);

const guard = getBearerCutoverGuard();
assert.equal(guard.success, true);
assert.equal(guard.current_auth_mode, "none");
assert.equal(guard.cutover_allowed_now, false);
assert.equal(guard.cutover_recommended_now, false);
assert.equal(guard.bearer_dry_run_success, true);
assert.equal(guard.bearer_ready_for_dry_run, true);
assert.equal(guard.bearer_ready_for_active_switch, false);
assert.equal(guard.token_file_configured, false);
assert.equal(guard.token_file_exists, false);
assert.equal(guard.token_path_disclosed, false);
assert.equal(guard.token_disclosed, false);
assert.equal(guard.connector_bearer_credential_verified, false);
assert.equal(guard.recommended_chatgpt_direct_delivery, "authorization_bearer_header");
assert.equal(guard.recommended_header_capable_client_delivery, "authorization_bearer_header");
assert.ok(guard.blockers.includes("MCP_TEST_TOKEN_FILE is not configured"));
assert.ok(guard.blockers.includes("MCP_TEST_TOKEN_FILE does not point to an existing file"));
assert.ok(guard.warnings.includes("active runtime is still auth.none; this guard intentionally does not change it"));
assert.ok(guard.cutover_plan.some((step) => step.includes("Authorization: Bearer <token>")));
assert.ok(guard.rollback_plan.some((step) => step.includes("Restart TEST MCP with MCP_TEST_AUTH_MODE=none")));
assert.equal(guard.dry_run_summary.valid_query_rejected_401, true);
assert.equal(guard.dry_run_summary.token_disclosed, false);
assert.equal(guard.dry_run_summary.token_path_disclosed, false);
for (const [key, value] of Object.entries(guard.explicit_non_scope)) {
  assert.equal(value, false, `explicit_non_scope.${key} must remain false`);
}

const tools = loadOptionalTools({
  profile: "internal",
  createRuntimeStatusTool: () => createTestMcpRuntimeStatusTool(() => ({ ok: true })),
  createObservabilityStatusTool: () => createObservabilityStatusTool({ runtimeStatusProvider: () => ({ enabled_tools: [] }) }),
});
const names = tools.map((tool) => tool.name).sort();
assert.equal(names.length, 38);
assert.ok(names.includes("auth_transition_status"));
assert.ok(names.includes("auth_bearer_dry_run"));
assert.ok(names.includes("auth_bearer_cutover_guard"));
assert.ok(names.includes("auth_modular_parity_status"));

const coreToolCount = 2;
assert.equal(names.length + coreToolCount, 40);

console.log("smoke_stage8_26_auth_precutover_freshness ok");
