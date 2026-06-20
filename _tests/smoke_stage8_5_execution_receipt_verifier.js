const assert = require("node:assert/strict");
const {
  executeReadonlyPlugin,
  verifyExecutionReceipt,
} = require("../src/plugin_execution");

function receiptArgs(envelope) {
  return {
    version: envelope.version,
    stage: envelope.stage,
    operation: envelope.operation,
    execution_id: envelope.execution_id,
    tool_name: envelope.tool_name,
    plugin_id: envelope.plugin_id,
    handler_type: envelope.handler_type,
    input_hash: envelope.input_hash,
    result_hash: envelope.result_hash,
    policy_hash: envelope.policy_hash,
    success: envelope.success ? "true" : "false",
  };
}

(async () => {
  const executed = await executeReadonlyPlugin({
    tool_name: "plugin_sample_echo_preview",
    text: "receipt verifier check",
  });
  assert.equal(executed.success, true);
  assert.ok(executed.audit_envelope);

  const valid = verifyExecutionReceipt(receiptArgs(executed.audit_envelope));
  assert.equal(valid.success, true);
  assert.equal(valid.receipt_valid, true);
  assert.equal(valid.execution_id_matches, true);
  assert.equal(valid.policy_hash_matches_current, true);
  assert.equal(valid.policy_hash_matches_expected, true);
  assert.equal(valid.verifier_flags.executes_plugin, false);
  assert.equal(valid.verifier_flags.dynamic_import_enabled, false);
  assert.equal(valid.verifier_flags.plugin_execution_allowed, false);
  assert.equal(valid.verifier_flags.real_tools_list_mutation_enabled, false);
  assert.equal(valid.verifier_flags.list_changed_enabled, false);

  const badExecutionId = verifyExecutionReceipt({
    ...receiptArgs(executed.audit_envelope),
    execution_id: "0".repeat(24),
  });
  assert.equal(badExecutionId.success, false);
  assert.equal(badExecutionId.receipt_valid, false);
  assert.equal(badExecutionId.execution_id_matches, false);
  assert.ok(badExecutionId.error.includes("execution_id mismatch"));

  const badPolicyHash = verifyExecutionReceipt({
    ...receiptArgs(executed.audit_envelope),
    policy_hash: "0".repeat(64),
  });
  assert.equal(badPolicyHash.success, false);
  assert.equal(badPolicyHash.receipt_valid, false);
  assert.equal(badPolicyHash.policy_hash_matches_current, false);
  assert.ok(badPolicyHash.error.includes("policy_hash"));

  const badStage = verifyExecutionReceipt({
    ...receiptArgs(executed.audit_envelope),
    stage: "old-stage",
  });
  assert.equal(badStage.success, false);
  assert.ok(badStage.error.includes("stage mismatch"));

  const badOperation = verifyExecutionReceipt({
    ...receiptArgs(executed.audit_envelope),
    operation: "mutate",
  });
  assert.equal(badOperation.success, false);
  assert.ok(badOperation.error.includes("operation is not allowed"));

  const missingPlugin = verifyExecutionReceipt({
    ...receiptArgs(executed.audit_envelope),
    plugin_id: "",
  });
  assert.equal(missingPlugin.success, false);
  assert.ok(missingPlugin.error.includes("non-governance operation requires plugin_id"));

  console.log("smoke_stage8_5_execution_receipt_verifier ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
