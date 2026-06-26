const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const spec = JSON.parse(read("SERVER_RUNTIME_TOPOLOGY_SPEC.json"));
const root = JSON.parse(read("SERVER_SPEC.json"));
const state = JSON.parse(read("_workflow/state.json"));
const sessionless = JSON.parse(read("_workflow/sessionless_inventory.json"));

assert.equal(spec.schema_version, "mcp-tests-runtime-topology-spec-v1");
assert.equal(spec.spec_mode, "canonical_structured_spec_not_progress_log");
assert.equal(spec.runtime_instances.public_3009.port, 3009);
assert.equal(spec.runtime_instances.public_3009.auth_mode, "none");
assert.equal(spec.runtime_instances.public_3009.expected_tool_count, 13);
assert.equal(spec.runtime_instances.oauth21_3008.port, 3008);
assert.equal(spec.runtime_instances.oauth21_3008.auth_mode, "oauth21");
assert.equal(spec.runtime_instances.oauth21_3008.expected_tool_count, 43);
assert.ok(spec.runtime_instances.oauth21_3008.required_startup_args.includes("--profile"));
assert.ok(spec.runtime_instances.oauth21_3008.required_startup_args.includes("--auth"));
assert.ok(spec.runtime_instances.oauth21_3008.required_startup_args.includes("--oauth-secret-file"));

assert.equal(spec.restart_authority.state, "repo_supervisor_authority_implemented_not_live_loaded");
assert.equal(spec.restart_authority.required_before_touching_oauth21_3008, true);
assert.ok(spec.restart_authority.forbidden_operations.some((x) => x.includes("generic port-kill")));
assert.ok(spec.restart_authority.forbidden_operations.some((x) => x.includes("test_mcp_restart.ps1")));
assert.ok(spec.validation_matrix.cross_runtime_forbidden[0].includes("restart 3009"));
assert.equal(spec.next_required_repair.status, "pending_live_operator_action");
assert.deepEqual(spec.restart_authority.supervisor_model.controlled_exit_codes, [42, 43, 44]);
assert.equal(spec.restart_authority.supervisor_model.restart_only_for_controlled_exit_codes, true);

assert.equal(root.spec_refs.runtime_topology, "SERVER_RUNTIME_TOPOLOGY_SPEC.json");
assert.equal(root.runtime_topology_spec.restart_authority_state, "repo_supervisor_authority_implemented_not_live_loaded");
assert.equal(state.runtime_topology_spec.path, "SERVER_RUNTIME_TOPOLOGY_SPEC.json");
assert.equal(state.runtime_topology_spec.oauth21_3008_blocked_until_authority_restored, false);
assert.equal(state.runtime_topology_spec.oauth21_3008_pending_supervisor_migration, true);

const restart = sessionless.deprecation_ledger.find((x) => x.feature_id === "restart_resilience");
assert.equal(restart.implementation_status, "partial");
assert.ok(JSON.stringify(restart).includes("SERVER_RUNTIME_TOPOLOGY_SPEC.json"));
assert.equal(sessionless.recommended_next.some((x) => x.startsWith("Audit all 41 Final SEPs")), false);

console.log("smoke_runtime_topology_authority ok");
