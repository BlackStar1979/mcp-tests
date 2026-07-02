const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const json = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const retiredStage12Root = "SERVER_" + "STAGE12.json";

assert.equal(exists(retiredStage12Root), false, "retired Stage12 root must not remain as active root spec");
assert.equal(exists("SERVER_DECISION_RUNTIME_SPEC.json"), true, "decision runtime root spec required");
assert.equal(exists("_workflow/historical/stage12_workflow_history.json"), true, "historical Stage12 source must be preserved outside root");

const rootSpec = json("SERVER_SPEC.json");
const decisionRuntime = json("SERVER_DECISION_RUNTIME_SPEC.json");
const tools = json("SERVER_TOOLS_SPEC.json");
const connector = json("SERVER_CONNECTOR_SURFACE_SPEC.json");
const policyRuntime = json("SERVER_POLICY_RUNTIME_SPEC.json");
const resourcePolicy = json("SERVER_RESOURCE_POLICY_SPEC.json");
const sampling = json("SERVER_SAMPLING_POLICY_SPEC.json");
const topology = json("SERVER_RUNTIME_TOPOLOGY_SPEC.json");
const state = json("_workflow/state.json");
const loader = read("_workflow/scripts/load_server_specs.js");

assert.equal(rootSpec.spec_refs.decision_runtime, "SERVER_DECISION_RUNTIME_SPEC.json");
assert.equal(rootSpec.spec_refs.historical_stage12, "_workflow/historical/stage12_workflow_history.json");
assert.ok(!Object.hasOwn(rootSpec.spec_refs, "stage12"));
assert.equal(rootSpec.stage12.status, "retired_from_root_specs");
assert.equal(rootSpec.stage12.replacement_spec_ref, "SERVER_DECISION_RUNTIME_SPEC.json");
assert.equal(rootSpec.decision_runtime.spec_ref, "SERVER_DECISION_RUNTIME_SPEC.json");

const activeRootFiles = new Set(rootSpec.repository_layout_contract.root_policy.active_root_files);
for (const rel of [
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
  "SERVER_RUNTIME_TOPOLOGY_SPEC.json",
  "SERVER_RUNTIME_CONFIG_SPEC.json",
]) {
  assert.ok(activeRootFiles.has(rel), `active root files missing ${rel}`);
}
assert.equal(activeRootFiles.has(retiredStage12Root), false);

assert.equal(decisionRuntime.schema_version, "mcp-tests-decision-runtime-spec-v1");
assert.equal(decisionRuntime.spec_mode, "canonical_structured_spec_not_progress_log");
assert.equal(decisionRuntime.historical_source.moved_to, "_workflow/historical/stage12_workflow_history.json");
assert.equal(JSON.stringify(decisionRuntime).includes(retiredStage12Root), false);
assert.ok(decisionRuntime.sections.decision_runtime_operator_gate);
assert.ok(!JSON.stringify(decisionRuntime).includes('"next_planned_step"'));
assert.ok(!JSON.stringify(decisionRuntime).includes('"last_result"'));

assert.equal(policyRuntime.runtime_enforced, true);
assert.equal(resourcePolicy.runtime_enforced, true);
assert.equal(policyRuntime.scope.includes("not runtime enforcement"), false);
assert.equal(policyRuntime.decision_runtime_spec_ref, "SERVER_DECISION_RUNTIME_SPEC.json");

assert.equal(tools.total_mcp_callable_tool_count, 43);
assert.equal(rootSpec.server.full_tests_authenticated_tool_count, 43);
assert.equal(connector.authenticated_connector.expected_public_plus_authorized_count, 43);
assert.equal(connector.authenticated_connector.expected_count_source.includes("SERVER_TOOLS_SPEC"), true);
assert.equal(connector.public_connector.expected_tool_count, 13);

assert.equal(sampling.spec_mode, "canonical_structured_spec_not_progress_log");
assert.equal(sampling.connector_visible, false);
assert.equal(topology.schema_version, "mcp-tests-runtime-topology-spec-v1");
assert.equal(topology.restart_authority.state, "repo_supervisor_authority_live_loaded_on_3008");
assert.equal(topology.runtime_instances.public_3009.port, 3009);
assert.equal(topology.runtime_instances.oauth21_3008.port, 3008);
assert.ok(topology.restart_authority.supervisor_model.scripts.includes("scripts/server.sh"));
assert.ok(topology.restart_authority.supervisor_model.scripts.includes("scripts/server.ps1"));
assert.deepEqual(rootSpec.restart_supervisor.controlled_exit_codes, [42, 43, 44]);
assert.ok(rootSpec.restart_supervisor.scripts.includes("scripts/server.sh"));
assert.ok(rootSpec.restart_supervisor.scripts.includes("scripts/server.ps1"));
assert.equal(rootSpec.restart_supervisor.request_helper, "scripts/request-restart.js");
assert.ok(rootSpec.restart_supervisor.argument_priority.includes("CLI arguments override"));
assert.ok(rootSpec.restart_supervisor.details_ref.includes("SERVER_RUNTIME_TOPOLOGY_SPEC.json"));

assert.ok(Object.hasOwn(state.root_spec_map, "SERVER_DECISION_RUNTIME_SPEC.json"));
assert.ok(Object.hasOwn(state.root_spec_map, "SERVER_RUNTIME_TOPOLOGY_SPEC.json"));
assert.ok(!Object.hasOwn(state.root_spec_map, retiredStage12Root));
assert.ok(loader.includes('readJson("SERVER_DECISION_RUNTIME_SPEC.json")'));
assert.equal(loader.includes('readJson("' + retiredStage12Root + '")'), false);

for (const rel of fs.readdirSync(ROOT).filter((name) => /^SERVER.*\.json$/.test(name))) {
  JSON.parse(read(rel));
}

console.log("smoke_root_server_specs_consistency ok");
