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
  if (json.error) return { __rpc_error: json.error };
  assert.ok(json.result, `${name} must return result`);
  const text = json.result?.content?.[0]?.text || "";
  assert.ok(text, `${name} must return content[0].text`);
  return JSON.parse(text);
}

(async () => {
  const governance = await callTool("plugin_execution_governance", {});
  assert.equal(governance.success, true);
  assert.equal(governance.mode, "plugin-execution-governance");
  assert.equal(governance.general_plugin_execution_allowed, false);
  assert.equal(governance.readonly_plugin_execution_wrapper_allowed, true);
  assert.equal(governance.dynamic_import_enabled, false);
  assert.equal(governance.arbitrary_plugin_file_execution_enabled, false);
  assert.equal(governance.real_tools_list_mutation_enabled, false);
  assert.equal(governance.list_changed_enabled, false);
  assert.deepEqual(governance.allowed_handler_types, ["builtin.echo.readonly.v1"]);
  assert.deepEqual(governance.allowed_risks, ["readonly-local"]);
  for (const item of governance.deny_matrix) {
    assert.equal(item.denied, true, `${item.capability} must be denied`);
  }
  for (const cap of ["network", "fs", "process", "write", "destructive", "dynamic_import", "unknown_handler"]) {
    assert.ok(governance.deny_matrix.some((item) => item.capability === cap), `missing deny matrix entry: ${cap}`);
  }

  const executed = await callTool("plugin_execute_readonly", {
    tool_name: "plugin_sample_echo_preview",
    text: "text field check",
  });
  assert.equal(executed.success, true);
  assert.equal(executed.result.echo, "text field check");
  assert.equal(executed.dynamic_import_enabled, false);
  assert.equal(executed.plugin_execution_allowed, false);

  const legacyFallback = await callTool("plugin_execute_readonly", {
    tool_name: "plugin_sample_echo_preview",
    arguments: { text: "legacy fallback check" },
  });
  assert.equal(legacyFallback.__rpc_error.code, -32602);
  assert.equal(legacyFallback.__rpc_error.data.decision_code, "invalid_tool_arguments");

  const invalid = await callTool("plugin_execute_readonly", {
    tool_name: "plugin_sample_echo_preview",
    input: { text: "ok", extra: "blocked" },
  });
  assert.equal(invalid.__rpc_error.code, -32602);
  assert.equal(invalid.__rpc_error.data.decision_code, "invalid_tool_arguments");
  assert.ok(invalid.__rpc_error.data.validation_errors.some((item) => item.includes("not allowed")));

  console.log("smoke_stage8_2_execution_governance ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
