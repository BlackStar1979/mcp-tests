"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const json = (...parts) => JSON.parse(read(...parts));

const record = read("_workflow", "operator_decisions", "stage14_8_runtime_enforcement_state_reconciliation.md");
const state = json("_workflow", "state.json");
const canon = read("_workflow", "WORKFLOW_CANON.md");
const index = read("_workflow", "ACTIVE_WORKFLOW_INDEX.md");
const policySpec = json("SERVER_POLICY_RUNTIME_SPEC.json");
const resourceSpec = json("SERVER_RESOURCE_POLICY_SPEC.json");
const handler = read("src", "runtime", "tools_call_handler.js");

assert.ok(record.includes("Status: GREEN / REPO-LIVE-WORKFLOW RECONCILED / NO RUNTIME CHANGE"));
assert.ok(record.includes("Stage 14.5 runtime enforcement is repo-applied at commit `d299cfa`"));
assert.ok(record.includes("server_start_id` is `2026-06-28T16:18:17.295Z`"));
assert.ok(record.includes("The active 3008 start is later than both commits"));
assert.ok(record.includes("public `3009` must not be described as currently live"));
assert.ok(record.includes("no live policy-denial probe injected"));

assert.equal(policySpec.runtime_enforced, true);
assert.equal(policySpec.integration_policy.runtime_enforcement_implemented_now, true);
assert.equal(resourceSpec.runtime_enforced, true);
assert.ok(handler.includes("decideRuntimePolicyGate"));
assert.ok(handler.includes("tool_call_policy_denied"));
assert.ok(handler.indexOf("decideRuntimePolicyGate") < handler.indexOf("tool_call_start"));

assert.equal(state.oauth21_durable_state.status, "implemented_repo_and_live_loaded_on_oauth21_3008");
assert.equal(state.policy_layers.runtime_policy_gate.runtime_enforced, true);
assert.equal(state.policy_layers.runtime_policy_gate.live_3008_status, "live_loaded_from_repo_applied_runtime_gate");
assert.equal(state.policy_layers.runtime_policy_gate.public_3009_status, "not_currently_live");
assert.equal(state.current_runtime_truth.oauth21_3008.runtime_gate_live_loaded_from_repo_applied_runtime_gate, true);
assert.equal(state.current_runtime_truth.oauth21_3008.restart_required_now, false);
assert.equal(state.current_runtime_truth.public_3009.currently_live_local, false);
assert.equal(state.current_runtime_truth.oauth21_3008.restart_required_now, false);
assert.equal(state.current_connector_truth.oauth21_3008_tools.connector_refresh_required_now, false);
assert.equal(Object.hasOwn(state, "runtime_enforcement_reconciliation"), false);

assert.ok(canon.includes("Stage 14.8 runtime enforcement state reconciliation green"));
assert.ok(canon.includes("public 3009 is not currently live"));
assert.ok(index.includes("stage14_8_runtime_enforcement_state_reconciliation.md"));
assert.ok(index.includes("Stage 14.8 runtime enforcement state reconciliation"));

console.log("smoke_runtime_enforcement_state_reconciliation ok");
