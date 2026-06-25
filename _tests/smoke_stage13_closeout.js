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

assert.equal(state.schema_version, "workflow-state-spec-map-v2");
assert.ok(!Object.hasOwn(state, "stage13"));
assert.ok(smokeScripts.includes("_tests/smoke_stage13_closeout.js"));

console.log("smoke_stage13_closeout ok");
