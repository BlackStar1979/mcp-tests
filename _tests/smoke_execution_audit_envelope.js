const assert = require("node:assert/strict");
const {
  AUDIT_ENVELOPE_VERSION,
  buildAuditEnvelope,
  executeReadonlyPlugin,
  getPluginExecutionGovernance,
  preflightPluginExecution,
} = require("../src/plugin_execution");

function assertEnvelope(envelope, operation) {
  assert.equal(envelope.version, AUDIT_ENVELOPE_VERSION);
  assert.equal(envelope.stage, "plugin-execution-audit-envelope");
  assert.equal(envelope.operation, operation);
  assert.equal(envelope.correlation_scope, "plugin-execution-wrapper");
  assert.equal(envelope.wrapper_mode, "readonly-allowlisted-builtin");
  assert.equal(envelope.dynamic_import_enabled, false);
  assert.equal(envelope.plugin_execution_allowed, false);
  assert.equal(envelope.real_tools_list_mutation_enabled, false);
  assert.equal(envelope.list_changed_enabled, false);
  assert.match(envelope.execution_id, /^[a-f0-9]{24}$/);
  assert.match(envelope.policy_hash, /^[a-f0-9]{64}$/);
}

(async () => {
  const deterministicA = buildAuditEnvelope({
    operation: "execute",
    toolName: "plugin_sample_echo_preview",
    pluginId: "sample.echo_readonly",
    handlerType: "builtin.echo.readonly.v1",
    inputHash: "a".repeat(64),
    resultHash: "b".repeat(64),
    success: true,
  });
  const deterministicB = buildAuditEnvelope({
    operation: "execute",
    toolName: "plugin_sample_echo_preview",
    pluginId: "sample.echo_readonly",
    handlerType: "builtin.echo.readonly.v1",
    inputHash: "a".repeat(64),
    resultHash: "b".repeat(64),
    success: true,
  });
  assert.deepEqual(deterministicA, deterministicB);
  assertEnvelope(deterministicA, "execute");

  const governance = getPluginExecutionGovernance();
  assert.equal(governance.success, true);
  assert.equal(governance.policy_hash, governance.audit_envelope.policy_hash);
  assertEnvelope(governance.audit_envelope, "governance");

  const preflight = await preflightPluginExecution({ tool_name: "plugin_sample_echo_preview" });
  assert.equal(preflight.success, true);
  assertEnvelope(preflight.audit_envelope, "preflight");
  assert.equal(preflight.audit_envelope.tool_name, "plugin_sample_echo_preview");
  assert.equal(preflight.audit_envelope.plugin_id, "sample.echo_readonly");
  assert.equal(preflight.audit_envelope.handler_type, "builtin.echo.readonly.v1");
  assert.equal(preflight.audit_envelope.success, true);

  const executed = await executeReadonlyPlugin({ tool_name: "plugin_sample_echo_preview", text: "audit envelope check" });
  assert.equal(executed.success, true);
  assert.equal(executed.result.echo, "audit envelope check");
  assertEnvelope(executed.audit_envelope, "execute");
  assert.equal(executed.audit_envelope.tool_name, "plugin_sample_echo_preview");
  assert.equal(executed.audit_envelope.plugin_id, "sample.echo_readonly");
  assert.equal(executed.audit_envelope.handler_type, "builtin.echo.readonly.v1");
  assert.equal(executed.audit_envelope.input_hash, executed.input_hash);
  assert.equal(executed.audit_envelope.result_hash, executed.result_hash);
  assert.equal(executed.audit_envelope.success, true);

  const invalid = await executeReadonlyPlugin({ tool_name: "plugin_sample_echo_preview", text: "" });
  assert.equal(invalid.success, false);
  assertEnvelope(invalid.audit_envelope, "execute");
  assert.equal(invalid.audit_envelope.success, false);
  assert.equal(invalid.audit_envelope.tool_name, "plugin_sample_echo_preview");

  const missing = await executeReadonlyPlugin({ tool_name: "missing_plugin_tool", text: "x" });
  assert.equal(missing.success, false);
  assertEnvelope(missing.audit_envelope, "execute");
  assert.equal(missing.audit_envelope.tool_name, "missing_plugin_tool");

  console.log("smoke_execution_audit_envelope ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
