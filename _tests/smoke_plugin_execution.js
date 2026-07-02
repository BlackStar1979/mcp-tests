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
  const preflight = await callTool("plugin_execution_preflight", {
    tool_name: "plugin_sample_echo_preview",
  });
  assert.equal(preflight.success, true);
  assert.equal(preflight.mode, "readonly-plugin-execution-preflight");
  assert.equal(preflight.execution_allowed_now, true);
  assert.equal(preflight.readonly_plugin_execution_wrapper_allowed, true);
  assert.equal(preflight.dynamic_import_enabled, false);
  assert.equal(preflight.plugin_execution_allowed, false);
  assert.equal(preflight.real_tools_list_mutation_enabled, false);
  assert.equal(preflight.list_changed_enabled, false);
  assert.equal(preflight.handler_type, "builtin.echo.readonly.v1");

  const executed = await callTool("plugin_execute_readonly", {
    tool_name: "plugin_sample_echo_preview",
    text: "hello wrapper",
  });
  assert.equal(executed.success, true);
  assert.equal(executed.mode, "readonly-plugin-execution-wrapper");
  assert.equal(executed.result.success, true);
  assert.equal(executed.result.echo, "hello wrapper");
  assert.equal(executed.readonly_plugin_execution_wrapper_allowed, true);
  assert.equal(executed.dynamic_import_enabled, false);
  assert.equal(executed.plugin_execution_allowed, false);
  assert.equal(executed.real_tools_list_mutation_enabled, false);
  assert.equal(executed.list_changed_enabled, false);

  const badArgs = await callTool("plugin_execute_readonly", {
    tool_name: "plugin_sample_echo_preview",
    text: "",
  });
  assert.equal(badArgs.__rpc_error.code, -32602);
  assert.equal(badArgs.__rpc_error.data.decision_code, "invalid_tool_arguments");
  assert.ok(badArgs.__rpc_error.data.validation_errors.some((item) => item.includes("minLength")));

  const unexpected = await callTool("plugin_execute_readonly", {
    tool_name: "plugin_sample_echo_preview",
    input: { text: "ok", extra: "nope" },
  });
  assert.equal(unexpected.__rpc_error.code, -32602);
  assert.equal(unexpected.__rpc_error.data.decision_code, "invalid_tool_arguments");
  assert.ok(unexpected.__rpc_error.data.validation_errors.some((item) => item.includes("not allowed")));

  const missing = await callTool("plugin_execution_preflight", {
    tool_name: "missing_plugin_tool",
  });
  assert.equal(missing.success, false);
  assert.equal(missing.execution_allowed_now, false);
  assert.equal(missing.readonly_plugin_execution_wrapper_allowed, false);

  console.log("smoke_plugin_execution ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
