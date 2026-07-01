const assert = require("node:assert/strict");
const {
  STATE_STORE_PREVIEW_VERSION,
  buildStateStoreWritePlan,
  planPersistentVisibilityStateChange,
  stateStoreHash,
  upsertStateRecord,
} = require("../src/plugin_visibility_state_store_preview");

const emptyStore = { records: [] };
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

const hashA = stateStoreHash({ records: [{ tool_name: "b", state: "candidate" }, { tool_name: "a", state: "disabled" }] });
const hashB = stateStoreHash({ records: [{ tool_name: "a", state: "disabled" }, { tool_name: "b", state: "candidate" }] });
assert.equal(hashA, hashB);

const invalidUpsert = upsertStateRecord({
  store: emptyStore,
  record: {
    tool_name: "plugin_sample_echo_preview",
    state: "enabled",
    source: "operator-state-store",
    updated_at: "",
    updated_by: "",
    reason: "",
  },
});
assert.equal(invalidUpsert.ok, false);
assert.ok(invalidUpsert.errors.includes("updated_at is required for mutating states"));
assert.ok(invalidUpsert.errors.includes("updated_by is required for mutating states"));
assert.ok(invalidUpsert.errors.includes("reason is required for mutating states"));

const enable = planPersistentVisibilityStateChange({
  currentStore: baseStore,
  toolName: "plugin_sample_echo_preview",
  targetState: "enabled",
  operator: "operator",
  reason: "enable preview",
  now: "2026-05-21T12:00:00.000Z",
  stateStorePath: "private/plugin_visibility_state.json",
});
assert.equal(enable.success, true);
assert.equal(enable.mode, "plugin-visibility-persistent-state-store-preview-only");
assert.equal(enable.state_store_preview_version, STATE_STORE_PREVIEW_VERSION);
assert.equal(enable.current_state, "candidate");
assert.equal(enable.target_state, "enabled");
assert.equal(enable.would_change_state, true);
assert.equal(enable.would_change_tools_list, true);
assert.equal(enable.would_require_list_changed, true);
assert.equal(enable.proposed_store_ok, true);
assert.equal(enable.write_plan.would_write, true);
assert.equal(enable.write_plan.atomic_write_required, true);
assert.equal(enable.write_plan.fs_write_enabled_now, false);
assert.equal(enable.write_plan.execute_allowed_now, false);
assert.equal(enable.write_plan.raw_path_redacted, true);
assert.equal(enable.fs_write_enabled_now, false);
assert.equal(enable.execute_allowed_now, false);
assert.equal(enable.real_mutation_enabled, false);
assert.equal(enable.list_changed_enabled_now, false);
assert.equal(enable.dynamic_import_enabled, false);
assert.equal(enable.raw_store_redacted, true);
assert.ok(enable.blockers.includes("state-store persistence is preview-only in Stage 8 / Step 40"));
assert.ok(enable.blockers.includes("notifications/tools/list_changed emission is disabled"));
assert.equal(enable.rollback.raw_store_redacted, true);
assert.equal(enable.rollback.operator_recorded, true);
assert.equal(enable.rollback.reason_recorded, true);
assert.equal(enable.rollback.rollback_required_for_quarantine, false);
assert.equal(typeof enable.rollback.rollback_hash, "string");

const noWrite = buildStateStoreWritePlan({ currentStore: baseStore, proposedStore: baseStore });
assert.equal(noWrite.would_write, false);
assert.equal(noWrite.atomic_write_required, false);
assert.deepEqual(noWrite.blockers, []);

const quarantine = planPersistentVisibilityStateChange({
  currentStore: baseStore,
  toolName: "plugin_sample_echo_preview",
  targetState: "quarantined",
  operator: "operator",
  reason: "quarantine preview",
  now: "2026-05-21T12:30:00.000Z",
});
assert.equal(quarantine.success, true);
assert.equal(quarantine.target_state, "quarantined");
assert.equal(quarantine.rollback.rollback_required_for_quarantine, true);
assert.ok(quarantine.required_approvals.includes("rollback/quarantine audit record"));
assert.equal(quarantine.real_mutation_enabled, false);

const missingMetadata = planPersistentVisibilityStateChange({
  currentStore: emptyStore,
  toolName: "plugin_sample_echo_preview",
  targetState: "enabled",
});
assert.equal(missingMetadata.success, false);
assert.ok(missingMetadata.error.includes("updated_at is required"));
assert.equal(missingMetadata.execute_allowed_now, false);
assert.equal(missingMetadata.real_mutation_enabled, false);

console.log("smoke_plugin_visibility_state_store_preview ok");
