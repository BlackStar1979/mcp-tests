const assert = require("node:assert/strict");
const { planPersistentVisibilityStateChange } = require("../src/plugin_visibility_state_store_preview");
const {
  STATE_STORE_RECEIPT_VERSION,
  buildStateStoreTransactionReceipt,
  verifyStateStoreTransactionReceipt,
} = require("../src/plugin_visibility_state_store_receipt");

const baseStore = {
  records: [
    {
      tool_name: "plugin_sample_echo_preview",
      state: "candidate",
      source: "operator-state-store",
      updated_at: "2026-05-21T00:00:00.000Z",
      updated_by: "operator",
      reason: "baseline",
    },
  ],
};

const enablePlan = planPersistentVisibilityStateChange({
  currentStore: baseStore,
  toolName: "plugin_sample_echo_preview",
  targetState: "enabled",
  operator: "operator",
  reason: "enable receipt preview",
  now: "2026-05-22T01:00:00.000Z",
  stateStorePath: "private/plugin_visibility_state.json",
});
const enableReceipt = buildStateStoreTransactionReceipt({
  plan: enablePlan,
  stage: "plugin-visibility-state-store-receipt",
  operation: "enable_preview",
  operator: "operator",
  reason: "enable receipt preview",
});
assert.equal(enableReceipt.version, STATE_STORE_RECEIPT_VERSION);
assert.equal(enableReceipt.tool_name, "plugin_sample_echo_preview");
assert.equal(enableReceipt.current_state, "candidate");
assert.equal(enableReceipt.target_state, "enabled");
assert.equal(enableReceipt.plan_success, true);
assert.equal(enableReceipt.would_change_state, true);
assert.equal(enableReceipt.would_change_tools_list, true);
assert.equal(enableReceipt.would_require_list_changed, true);
assert.equal(enableReceipt.would_write, true);
assert.equal(enableReceipt.atomic_write_required, true);
assert.equal(enableReceipt.fs_write_enabled_now, false);
assert.equal(enableReceipt.execute_allowed_now, false);
assert.equal(enableReceipt.real_mutation_enabled, false);
assert.equal(enableReceipt.list_changed_enabled_now, false);
assert.equal(enableReceipt.dynamic_import_enabled, false);
assert.equal(enableReceipt.raw_record_redacted, true);
assert.equal(enableReceipt.raw_store_redacted, true);
assert.equal(enableReceipt.raw_path_redacted, true);
assert.equal(enableReceipt.transaction_applied, false);
assert.equal(enableReceipt.fs_write_performed, false);
assert.equal(enableReceipt.list_changed_emitted, false);
assert.equal(typeof enableReceipt.receipt_hash, "string");
assert.equal(verifyStateStoreTransactionReceipt(enableReceipt).success, true);

const quarantinePlan = planPersistentVisibilityStateChange({
  currentStore: baseStore,
  toolName: "plugin_sample_echo_preview",
  targetState: "quarantined",
  operator: "operator",
  reason: "quarantine receipt preview",
  now: "2026-05-22T01:10:00.000Z",
});
const quarantineReceipt = buildStateStoreTransactionReceipt({ plan: quarantinePlan, stage: "plugin-visibility-state-store-receipt", operation: "quarantine_preview" });
assert.equal(quarantineReceipt.target_state, "quarantined");
assert.equal(quarantineReceipt.rollback_required_for_quarantine, true);
assert.equal(verifyStateStoreTransactionReceipt(quarantineReceipt).success, true);

const missingMetadataPlan = planPersistentVisibilityStateChange({
  currentStore: { records: [] },
  toolName: "plugin_sample_echo_preview",
  targetState: "enabled",
});
const failureReceipt = buildStateStoreTransactionReceipt({ plan: missingMetadataPlan, stage: "plugin-visibility-state-store-receipt", operation: "failure_preview" });
assert.equal(failureReceipt.plan_success, false);
assert.equal(failureReceipt.transaction_applied, false);
assert.equal(failureReceipt.fs_write_performed, false);
assert.equal(verifyStateStoreTransactionReceipt(failureReceipt).success, true);

const tampered = { ...enableReceipt, after_hash: "tampered" };
const tamperedResult = verifyStateStoreTransactionReceipt(tampered);
assert.equal(tamperedResult.success, false);
assert.ok(tamperedResult.errors.includes("receipt_hash mismatch"));

const applied = { ...enableReceipt, transaction_applied: true };
const appliedResult = verifyStateStoreTransactionReceipt(applied);
assert.equal(appliedResult.success, false);
assert.ok(appliedResult.errors.includes("preview receipt must not record applied transaction"));

const badQuarantine = { ...quarantineReceipt, rollback_required_for_quarantine: false };
const badQuarantineResult = verifyStateStoreTransactionReceipt(badQuarantine);
assert.equal(badQuarantineResult.success, false);
assert.ok(badQuarantineResult.errors.includes("quarantine requires rollback receipt marker"));

console.log("smoke_plugin_visibility_state_store_receipt ok");
