"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const json = (...parts) => JSON.parse(read(...parts));

const record = read("_workflow", "operator_decisions", "stage14_runtime_enforcement_no_apply_package.md");
const canon = read("_workflow", "WORKFLOW_CANON.md");
const index = read("_workflow", "ACTIVE_WORKFLOW_INDEX.md");
const state = json("_workflow", "state.json");
const smokeScripts = json("_tests", "run_all_smoke_scripts.json");
const toolsCall = read("src", "runtime", "tools_call_handler.js");
const policyRuntimeSpec = json("SERVER_POLICY_RUNTIME_SPEC.json");
const resourcePolicySpec = json("SERVER_RESOURCE_POLICY_SPEC.json");

for (const required of [
  "GREEN / PACKAGE STARTED / NO APPLY",
  "Stage 14.1 starts the package as reviewable no-apply work only",
  "operator_approved_runtime_policy_enforcement_apply",
  "FUTURE OPERATOR-APPROVED policy preflight enforcement hook",
  "no runtime-imported code change",
  "no tools_call_handler wiring",
  "no runtime policy denial behavior change",
]) assert.ok(record.includes(required), required);

assert.ok(record.includes("before `tool_call_start`"));
assert.ok(record.includes("before handler execution"));
assert.equal(policyRuntimeSpec.runtime_enforced, true);
assert.ok(JSON.stringify(policyRuntimeSpec).includes("runtime_enforcement_expected_now"));
assert.ok(JSON.stringify(policyRuntimeSpec).includes("false"));
assert.equal(resourcePolicySpec.runtime_enforced, true);
assert.equal(toolsCall.includes("FUTURE OPERATOR-APPROVED policy preflight enforcement hook"), false);
assert.equal(toolsCall.includes("policy_preflight"), false);

assert.ok(canon.includes("Stage 14.1 runtime enforcement no-apply package green"));
assert.ok(index.includes("stage14_runtime_enforcement_no_apply_package.md"));
assert.ok(index.includes("Stage 14.1 runtime enforcement no-apply guard"));

assert.equal(state.schema_version, "workflow-state-spec-map-v2");
assert.ok(!Object.hasOwn(state, "stage14"));
assert.ok(smokeScripts.includes("_tests/smoke_stage14_runtime_enforcement_no_apply_package.js"));

console.log("smoke_stage14_runtime_enforcement_no_apply_package ok");
