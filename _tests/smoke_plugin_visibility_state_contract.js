const assert = require("node:assert/strict");
const {
  STATE_STORE_VERSION,
  defaultStateRecord,
  isValidVisibilityState,
  lookupVisibilityState,
  normalizeStateStore,
  planVisibilityStateTransition,
  validateStateRecord,
} = require("../src/plugin_visibility_state");

assert.equal(STATE_STORE_VERSION, "test-mcp-plugin-visibility-state-v1");
assert.equal(isValidVisibilityState("candidate"), true);
assert.equal(isValidVisibilityState("enabled"), true);
assert.equal(isValidVisibilityState("disabled"), true);
assert.equal(isValidVisibilityState("quarantined"), true);
assert.equal(isValidVisibilityState("active"), false);

const defaultRecord = defaultStateRecord("plugin_sample_echo_preview");
assert.deepEqual(defaultRecord, {
  tool_name: "plugin_sample_echo_preview",
  state: "candidate",
  source: "manifest",
  updated_at: "",
  updated_by: "",
  reason: "",
});

assert.equal(validateStateRecord(defaultRecord).ok, true);
assert.equal(validateStateRecord({ tool_name: "bad name", state: "candidate" }).ok, false);
assert.equal(validateStateRecord({ tool_name: "plugin_sample_echo_preview", state: "unknown" }).ok, false);
assert.equal(validateStateRecord({ tool_name: "plugin_sample_echo_preview", state: "enabled" }, { allowEmptyMetadata: false }).ok, false);

const normalized = normalizeStateStore({
  records: [
    { tool_name: "plugin_sample_echo_preview", state: "disabled", source: "operator", updated_at: "2026-05-20T00:00:00.000Z", updated_by: "operator", reason: "test" },
  ],
});
assert.equal(normalized.ok, true);
assert.equal(normalized.records.length, 1);
assert.equal(normalized.records[0].state, "disabled");

const duplicate = normalizeStateStore({
  records: [
    { tool_name: "plugin_sample_echo_preview", state: "candidate" },
    { tool_name: "plugin_sample_echo_preview", state: "disabled" },
  ],
});
assert.equal(duplicate.ok, false);
assert.ok(duplicate.errors.some((error) => error.includes("duplicate state record")));

const lookupExisting = lookupVisibilityState("plugin_sample_echo_preview", normalized);
assert.equal(lookupExisting.state, "disabled");
assert.equal(lookupExisting.state_store_ok, true);

const lookupMissing = lookupVisibilityState("plugin_other_preview", normalized);
assert.equal(lookupMissing.state, "candidate");
assert.equal(lookupMissing.source, "manifest");

const enablePlan = planVisibilityStateTransition({
  toolName: "plugin_sample_echo_preview",
  currentState: "candidate",
  targetState: "enabled",
  operator: "operator",
  reason: "future test",
});
assert.equal(enablePlan.success, true);
assert.equal(enablePlan.mode, "plugin-visibility-state-preview-only");
assert.equal(enablePlan.would_change_state, true);
assert.equal(enablePlan.would_change_tools_list, true);
assert.equal(enablePlan.would_require_list_changed, true);
assert.equal(enablePlan.real_mutation_enabled, false);
assert.equal(enablePlan.execute_allowed_now, false);
assert.equal(enablePlan.operator_recorded, true);
assert.equal(enablePlan.reason_recorded, true);
assert.ok(enablePlan.required_approvals.includes("explicit operator approval"));
assert.ok(enablePlan.required_approvals.includes("client refresh or notifications/tools/list_changed workflow"));

const quarantinePlan = planVisibilityStateTransition({
  toolName: "plugin_sample_echo_preview",
  currentState: "enabled",
  targetState: "quarantined",
});
assert.equal(quarantinePlan.success, true);
assert.equal(quarantinePlan.would_change_tools_list, true);
assert.equal(quarantinePlan.real_mutation_enabled, false);
assert.ok(quarantinePlan.required_approvals.includes("rollback/quarantine audit record"));

const noDiff = planVisibilityStateTransition({
  toolName: "plugin_sample_echo_preview",
  currentState: "candidate",
  targetState: "candidate",
});
assert.equal(noDiff.success, true);
assert.equal(noDiff.would_change_state, false);
assert.equal(noDiff.would_change_tools_list, false);
assert.ok(noDiff.warnings.some((warning) => warning.includes("target state equals current state")));

const invalid = planVisibilityStateTransition({
  toolName: "plugin_sample_echo_preview",
  currentState: "candidate",
  targetState: "active",
});
assert.equal(invalid.success, false);
assert.ok(invalid.error.includes("targetState is invalid"));
assert.equal(invalid.execute_allowed_now, false);

console.log("smoke_plugin_visibility_state_contract ok");
