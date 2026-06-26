const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const matrix = read("SERVER_POLICY_COVERAGE_MATRIX_SPEC.json");
const server = read("SERVER_SPEC.json");
const state = read("_workflow/state.json");
assert.equal(matrix.schema_version, "mcp-tests-policy-coverage-matrix-v1");
assert.equal(matrix.rules.target_set_is_authoritative, true);
assert.equal(matrix.rules.no_complete_claim_if_any_required_policy_target_missing, true);
const urgent = matrix.policies.filter((p) => p.critical);
assert.equal(urgent.length, 6);
for (const p of urgent) { assert.notEqual(p.status, "target_missing"); assert.ok(fs.existsSync(path.join(ROOT, p.spec_ref))); const spec = read(p.spec_ref); assert.equal(spec.spec_mode, "canonical_structured_spec_not_progress_log"); assert.equal(spec.priority, "critical"); assert.equal(spec.runtime_change, false); assert.ok(server.repository_layout_contract.root_policy.active_root_files.includes(p.spec_ref)); assert.ok(Object.hasOwn(state.root_spec_map, p.spec_ref)); }
assert.ok(matrix.policies.some((p) => p.status === "target" + "_missing"));
console.log("smoke_policy_coverage_matrix ok");
