"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const matrixPath = path.join(root, "_workflow", "inventories", "ops_1a_operational_e2e_matrix.json");
const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));

assert.equal(matrix.schema_version, "mcp-tests-ops-1a-operational-e2e-matrix-v1");
assert.deepEqual(matrix.evidence_modes, ["hermetic", "live_read_only", "operator_observed"]);

const expectedFamilies = [
  "restart_recovery",
  "reconnect_transport",
  "cancellation_timeout",
  "cloudflare_tunnel",
  "sftp_remote_site",
  "network_tools",
  "process_execution",
  "destructive_rollback",
];
assert.deepEqual(matrix.families.map((family) => family.id), expectedFamilies);

for (const family of matrix.families) {
  assert.ok(["high", "medium", "low"].includes(family.risk), `${family.id} risk`);
  assert.ok(matrix.coverage_statuses.includes(family.status), `${family.id} status`);
  assert.ok(family.positive_negative, `${family.id} positive/negative classification`);
  assert.ok(family.observability, `${family.id} observability`);
  assert.ok(family.rollback_proof, `${family.id} rollback proof`);
  assert.ok(Array.isArray(family.evidence) && family.evidence.length > 0, `${family.id} evidence`);
  for (const evidencePath of family.evidence) {
    assert.ok(fs.existsSync(path.join(root, evidencePath)), `${family.id} missing evidence: ${evidencePath}`);
  }
  if (family.status !== "covered") assert.ok(family.gap, `${family.id} unresolved gap`);
}

assert.ok(matrix.soak_cases.length >= 10);
for (const testCase of matrix.soak_cases) {
  assert.ok(fs.existsSync(path.join(root, testCase.script)), `missing soak script: ${testCase.script}`);
}

const listResult = spawnSync(process.execPath, [
  "scripts/run_operational_e2e_soak.js",
  "--list",
  "--repetitions",
  "2",
  "--live-repetitions",
  "3",
], {
  cwd: root,
  encoding: "utf8",
});
assert.equal(listResult.status, 0, listResult.stderr);
const listed = JSON.parse(listResult.stdout);
assert.equal(listed.repetitions, 2);
assert.equal(listed.live_repetitions, 3);
assert.equal(listed.selected.every((item) => item.mode === "hermetic"), true);
assert.equal(listed.selected.length, matrix.soak_cases.filter((item) => item.default).length);

const rejected = spawnSync(process.execPath, [
  "scripts/run_operational_e2e_soak.js",
  "--list",
  "--surprise",
], {
  cwd: root,
  encoding: "utf8",
});
assert.equal(rejected.status, 2, rejected.stderr || rejected.stdout);
const rejectedJson = JSON.parse(rejected.stderr);
assert.equal(rejectedJson.error_code, "cli_argument_unknown");
assert.equal(rejectedJson.argument, "surprise");

console.log("smoke_operational_e2e_matrix ok");
