const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const statePath = path.join(ROOT, "_workflow", "state.json");
const stateText = fs.readFileSync(statePath, "utf8");
const state = JSON.parse(stateText);

assert.equal(state.schema_version, "workflow-state-spec-map-v2");
assert.equal(state.status, "compact_orientation_map_not_progress_log");
assert.ok(stateText.length < 15000, "state.json must remain compact");

for (const key of [
  "server_identity",
  "runtime_topology",
  "root_spec_map",
  "tool_surfaces",
  "policy_layers",
  "sessionless_inventory",
  "current_work_constraints",
  "history_policy",
]) {
  assert.ok(Object.hasOwn(state, key), `missing ${key}`);
}

for (const forbidden of [
  "current_work_package",
  "stage7",
  "stage8",
  "stage9",
  "stage10",
  "stage11",
  "stage12",
  "stage13",
  "stage14",
  "operator_decisions",
]) {
  assert.ok(!Object.hasOwn(state, forbidden), `state.json must not contain progress-history key ${forbidden}`);
}

for (const spec of [
  "SERVER_SPEC.json",
  "SERVER_AUTH_SPEC.json",
  "SERVER_CONNECTOR_SURFACE_SPEC.json",
  "SERVER_TOOLS_SPEC.json",
  "SERVER_PROFILES_SPEC.json",
  "SERVER_AUTHZ_DECISION_SPEC.json",
  "SERVER_RESOURCE_POLICY_SPEC.json",
  "SERVER_POLICY_RUNTIME_SPEC.json",
  "SERVER_NETWORK_POLICY_SPEC.json",
  "SERVER_MEMORY_POLICY_SPEC.json",
  "SERVER_DATABASE_POLICY_SPEC.json",
  "SERVER_PLUGIN_VISIBILITY_POLICY_SPEC.json",
  "SERVER_SAMPLING_POLICY_SPEC.json",
  "SERVER_DECISION_RUNTIME_SPEC.json",
]) {
  assert.ok(Object.hasOwn(state.root_spec_map, spec), `missing root spec map entry ${spec}`);
}

assert.equal(state.runtime_topology.public.port, 3009);
assert.equal(state.runtime_topology.authorized.port, 3008);
assert.equal(state.tool_surfaces.public_mcp_tools.count, 13);
assert.equal(state.tool_surfaces.authenticated_total.count, 43);
assert.equal(state.sessionless_inventory.coverage.official_final_seps, 41);
assert.equal(state.sessionless_inventory.coverage.unclassified, 0);
assert.equal(state.current_work_constraints.do_not_use_state_json_as_log, true);

console.log("smoke_workflow_state_compact_spec_map ok");

assert.ok(!Object.hasOwn(state.root_spec_map, "SERVER_STAGE12.json"));
