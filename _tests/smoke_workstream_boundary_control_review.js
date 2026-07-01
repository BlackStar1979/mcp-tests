"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const canon = read("_workflow/WORKFLOW_CANON.md");
const smokeScripts = JSON.parse(read("_tests/run_all_smoke_scripts.json"));

assert.ok(canon.includes("Boundary-control review correction: the workstream boundary review is defined by its control decision"));
assert.ok(canon.includes("not by a supporting coverage package"));
assert.ok(canon.includes("Auth behavior freeze"));
assert.ok(canon.includes("Connector-visible surface freeze"));
assert.ok(canon.includes("Raw audit export prohibition"));
assert.ok(canon.includes("Restart requires explicit operator intent"));
assert.ok(canon.includes("Connector refresh requires explicit operator intent"));
assert.ok(canon.includes("mechanism endurance"));
assert.ok(canon.includes("Required now: none"));
assert.ok(canon.includes("Latest known full smoke: `node ./_tests/run_all_smokes.js --skip-network = ok_0_40_0_7_209`"));
assert.ok(smokeScripts.includes("_tests/smoke_decision_runtime_p1_coverage.js"));

console.log("smoke_workstream_boundary_control_review ok");
