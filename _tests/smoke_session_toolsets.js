const assert = require("node:assert/strict");

const MCP_URL = process.env.MCP_TEST_SMOKE_URL || "http://127.0.0.1:3009/mcp";

async function callTool(name, args = {}) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `${name}-${Date.now()}`,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  assert.equal(response.status, 200, `${name} HTTP status`);
  const json = await response.json();
  assert.ok(json.result, `${name} must return result`);
  const text = json.result?.content?.[0]?.text || "";
  assert.ok(text, `${name} must return content[0].text`);
  return JSON.parse(text);
}

(async () => {
  const status = await callTool("session_toolset_status", {});
  assert.equal(status.success, true);
  assert.equal(status.mode, "session-toolset-preview-only");
  assert.equal(status.gateway.gateway_server_enabled, false);
  assert.equal(status.gateway.session_store_enabled, false);
  assert.equal(status.gateway.per_session_tools_list_enabled, false);
  assert.equal(status.gateway.list_changed_enabled, false);
  assert.equal(status.current_global_tool_surface_count, 13);
  assert.equal(status.profiles.public.active_core_tool_count, 13);
  assert.equal(status.profiles.public.candidate_plugin_tool_count, 1);
  assert.equal(status.profiles.public.real_session_mutation_enabled, false);
  assert.equal(status.dynamic_import_enabled, false);
  assert.equal(status.plugin_execution_enabled, false);
  assert.equal(status.per_session_tools_list_enabled, false);
  assert.equal(status.list_changed_enabled, false);

  const publicCore = await callTool("session_toolset_plan", {
    profile: "public",
    include_plugin_candidates: false,
    detail_level: "summary",
  });
  assert.equal(publicCore.success, true);
  assert.equal(publicCore.profile, "public");
  assert.equal(publicCore.proposed_tool_count, 13);
  assert.equal(publicCore.active_core_tool_count, 13);
  assert.equal(publicCore.candidate_plugin_tool_count, 0);
  assert.equal(publicCore.real_session_mutation_enabled, false);
  assert.equal(publicCore.would_require_gateway, false);
  assert.equal(publicCore.would_require_list_changed, false);

  const publicWithCandidates = await callTool("session_toolset_plan", {
    profile: "public",
    include_plugin_candidates: true,
    detail_level: "summary",
  });
  assert.equal(publicWithCandidates.success, true);
  assert.equal(publicWithCandidates.proposed_tool_count, 14);
  assert.equal(publicWithCandidates.candidate_plugin_tool_count, 1);
  assert.equal(publicWithCandidates.would_require_gateway, true);
  assert.equal(publicWithCandidates.would_require_list_changed, true);
  assert.equal(publicWithCandidates.plugin_execution_enabled, false);
  assert.ok(publicWithCandidates.proposed_tools.some((tool) => tool.tool_name === "plugin_sample_echo_preview"));

  const internal = await callTool("session_toolset_plan", {
    profile: "internal",
    include_plugin_candidates: true,
    detail_level: "summary",
  });
  assert.equal(internal.success, true);
  assert.equal(internal.profile, "internal");
  assert.equal(internal.would_require_auth, true);
  assert.equal(internal.would_require_gateway, true);
  assert.equal(internal.gateway.gateway_server_enabled, false);
  assert.ok(internal.warnings.some((item) => item.includes("internal")));

  console.log("smoke_session_toolsets ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
