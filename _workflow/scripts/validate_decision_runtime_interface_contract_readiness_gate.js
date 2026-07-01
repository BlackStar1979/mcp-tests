#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { loadDecisionRuntimeSpec } = require("./load_server_specs");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function exists(file) {
  return fs.existsSync(file);
}

const spec = loadDecisionRuntimeSpec();
const history = readJson("_workflow/historical/stage12_workflow_history.json");
const gate = spec.sections?.decision_runtime_interface_contract_readiness_gate;
const historicalGate = history.sections?.decision_runtime_interface_contract_readiness_gate;
const errors = [];

function expect(condition, message) {
  if (!condition) errors.push(message);
}

expect(Boolean(gate), "missing active decision_runtime_interface_contract_readiness_gate section");
expect(Boolean(historicalGate), "missing historical decision_runtime_interface_contract_readiness_gate section");

if (gate) {
  expect(gate.status === "passed_for_runtime_integration_planning_only", "unexpected active gate status");
  expect(gate.mode === "readiness_gate_only_no_runtime_change", "unexpected active gate mode");
  expect(gate.tool === "_workflow/scripts/validate_decision_runtime_interface_contract_readiness_gate.js", "active gate tool path mismatch");
  expect(gate.smoke === "_tests/smoke_decision_runtime_interface_contract_readiness_gate.js", "active gate smoke path mismatch");
  expect(exists("_tests/smoke_decision_runtime_interface_contract_readiness_gate.js"), "active gate smoke file missing");
  expect(gate.gate_decision?.ready_for_runtime_integration_planning === true, "active gate should allow runtime integration planning");
  expect(gate.gate_decision?.runtime_implementation_ready === false, "active gate must not allow runtime implementation");
  expect(gate.gate_decision?.server_runtime_integrated === false, "active gate must remain non-integrated");
  expect(gate.gate_decision?.mcp_tool_exposed === false, "active gate must remain non-exposed");
  expect(gate.gate_decision?.connector_visible_change_allowed === false, "active gate must keep connector-visible change disabled");
  expect(gate.documentation_audit?.status === "complete", "active gate documentation audit must remain complete");
  expect(gate.gate_inputs?.expected_full_smoke_results_after_registration === 106, "active gate expected smoke count mismatch");
}

if (historicalGate) {
  expect(historicalGate.status === "passed_for_runtime_integration_planning_only", "unexpected historical gate status");
  expect(historicalGate.tool === "_workflow/scripts/validate_decision_runtime_interface_contract_readiness_gate.js", "historical gate tool path mismatch");
  expect(historicalGate.smoke === "_tests/smoke_decision_runtime_interface_contract_readiness_gate.js", "historical gate smoke path mismatch");
}

const result = {
  ok: errors.length === 0,
  gate_status: gate?.status ?? null,
  ready_for_runtime_integration_planning: gate?.gate_decision?.ready_for_runtime_integration_planning === true,
  runtime_implementation_ready: gate?.gate_decision?.runtime_implementation_ready === true,
  server_runtime_integrated: gate?.gate_decision?.server_runtime_integrated === true,
  mcp_tool_exposed: gate?.gate_decision?.mcp_tool_exposed === true,
  connector_visible_change_allowed: gate?.gate_decision?.connector_visible_change_allowed === true,
  documentation_state_audit: gate?.documentation_audit?.status ?? null,
  expected_full_smoke_results_after_registration: gate?.gate_inputs?.expected_full_smoke_results_after_registration ?? null,
  errors,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
