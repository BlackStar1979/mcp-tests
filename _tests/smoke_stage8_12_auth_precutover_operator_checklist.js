const assert = require("node:assert/strict");
const { CURRENT_STAGE_STATUS } = require("../src/stage_metadata");

const MCP_URL = process.env.MCP_TEST_SMOKE_URL || "http://127.0.0.1:3009/mcp";

async function rpc(method, params = {}) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: `${method}-${Date.now()}`, method, params }),
  });
  assert.equal(response.status, 200, `${method} HTTP status`);
  return response.json();
}

async function callTool(name, args = {}) {
  const json = await rpc("tools/call", { name, arguments: args });
  assert.ok(json.result, `${name} must return result`);
  const text = json.result?.content?.[0]?.text || "";
  assert.ok(text, `${name} must return content[0].text`);
  return JSON.parse(text);
}

(async () => {
  const listed = await rpc("tools/list", {});
  const toolNames = (listed.result?.tools || []).map((tool) => tool.name);
  assert.equal(toolNames.length, 46);
  assert.ok(toolNames.includes("observability_status"));
  assert.ok(toolNames.includes("auth_bearer_cutover_guard"));
  assert.ok(toolNames.includes("auth_modular_parity_status"));
  assert.ok(toolNames.includes("memory_save"));

  const runtime = await callTool("test_mcp_runtime_status", { include_tools: true });
  assert.equal(runtime.server_version, "0.30.0");
  assert.equal(runtime.stage_status, CURRENT_STAGE_STATUS);
  assert.equal(runtime.auth.mode, "access");
  assert.equal(runtime.auth.requires_auth, true);
  assert.equal(runtime.profile.mode, "internal");
  assert.equal(runtime.security_boundary.status, "ok");
  assert.equal(runtime.enabled_tools.length, 46);

  const parity = await callTool("auth_modular_parity_status", {});
  assert.equal(parity.success, true);
  assert.equal(parity.access_cloudflare_ready, true);
  assert.equal(parity.bearer_header_ready, true);
  assert.equal(parity.bearer_query_ready, true);
  assert.deepEqual(parity.blockers, []);
  assert.equal(parity.explicit_non_scope.changes_active_auth_mode, false);
  assert.equal(parity.explicit_non_scope.writes_real_secret, false);

  const transition = await callTool("auth_transition_status", {});
  assert.equal(transition.success, true);
  assert.ok(["none", "access"].includes(transition.current_auth_mode));
  assert.equal(transition.bearer_ready_for_dry_run, true);
  assert.equal(transition.bearer_ready_for_active_switch, false);
  assert.equal(transition.token_file_configured, false);
  assert.equal(transition.token_file_exists, false);
  assert.equal(transition.explicit_non_scope.changes_active_auth_mode, false);
  assert.equal(transition.explicit_non_scope.writes_secret, false);
  assert.ok(transition.no_auth_exit_workflow.some((step) => step.includes("token file")));

  const guard = await callTool("auth_bearer_cutover_guard", {});
  assert.equal(guard.success, true);
  assert.ok(["none", "access"].includes(guard.current_auth_mode));
  assert.equal(guard.cutover_allowed_now, false);
  assert.equal(guard.cutover_recommended_now, false);
  assert.equal(guard.bearer_dry_run_success, true);
  assert.equal(guard.bearer_ready_for_dry_run, true);
  assert.equal(guard.bearer_ready_for_active_switch, false);
  assert.equal(guard.token_file_configured, false);
  assert.equal(guard.token_file_exists, false);
  assert.equal(guard.token_disclosed, false);
  assert.equal(guard.token_path_disclosed, false);
  assert.ok(guard.blockers.includes("MCP_TEST_TOKEN_FILE is not configured"));
  assert.ok(guard.blockers.includes("MCP_TEST_TOKEN_FILE does not point to an existing file"));
  assert.ok(guard.cutover_plan.some((step) => step.includes("MCP_TEST_AUTH_MODE=bearer")));
  assert.ok(guard.rollback_plan.some((step) => step.includes("MCP_TEST_AUTH_MODE=none")));
  assert.equal(guard.explicit_non_scope.changes_active_auth_mode, false);
  assert.equal(guard.explicit_non_scope.writes_secret, false);

  const observability = await callTool("observability_status", {
    window_size: 500,
    slow_ms: 1000,
    top_n: 5,
    connector_visible_tools: toolNames,
  });
  assert.equal(observability.success, true);
  assert.equal(observability.runtime.server_version, "0.30.0");
  assert.equal(observability.runtime.auth_mode, "access");
  assert.equal(observability.runtime.enabled_tool_count, 46);
  assert.equal(observability.connector_map.comparison_available, true);
  assert.equal(observability.connector_map.status, "in_sync");
  assert.deepEqual(observability.connector_map.missing_in_connector, []);
  assert.deepEqual(observability.connector_map.extra_in_connector, []);
  assert.equal(observability.connector_map.refresh_recommended, false);
  assert.equal(observability.audit_log.parse_errors, 0);
  assert.equal(observability.events.tool_call_error_count, 0);
  assert.equal(typeof observability.latency.delayed_response_count, "number");
  assert.ok(observability.latency.delayed_response_count >= 0);

  console.log("smoke_stage8_12_auth_precutover_operator_checklist ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
