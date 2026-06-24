"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

const closeout = read("_workflow", "operator_decisions", "stage13_closeout.md");
const canon = read("_workflow", "WORKFLOW_CANON.md");
const index = read("_workflow", "ACTIVE_WORKFLOW_INDEX.md");
const state = JSON.parse(read("_workflow", "state.json"));
const smokeScripts = JSON.parse(read("_tests", "run_all_smoke_scripts.json"));

for (const key of ["stage13_1", "stage13_2", "stage13_3", "stage13_4"]) {
  assert.equal(state.stage13[key].status, "green", key);
}

for (const required of [
  "GREEN / CLOSED",
  "No operator approval for Stage 14 implementation is recorded",
  "Any Stage 14 implementation requires separate operator acceptance",
  "ok_0_40_0_6_157",
  "no runtime enforcement",
]) assert.ok(closeout.includes(required), required);

assert.ok(canon.includes("Stage 13 closeout green"));
assert.ok(canon.includes("No Stage 14 implementation approval is recorded"));
assert.ok(index.includes("stage13_closeout.md"));
assert.ok(index.includes("Stage 13 closeout guard"));

assert.equal(state.stage13.status, "green_closed");
assert.equal(state.stage13.closeout.status, "green");
assert.equal(state.stage13.closeout.stage14_implementation_approved, false);
assert.equal(state.stage13.closeout.runtime_enforcement_changed, false);
assert.ok(state.next_allowed_work.includes("Present Stage 14 proposal/recommendation for operator review"));
assert.ok(smokeScripts.includes("_tests/smoke_stage13_closeout.js"));

console.log("smoke_stage13_closeout ok");
