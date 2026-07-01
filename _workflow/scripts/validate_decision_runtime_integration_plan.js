#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { loadDecisionRuntimeSpec } = require("./load_server_specs");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const spec = loadDecisionRuntimeSpec();
const history = readJson("_workflow/historical/stage12_workflow_history.json");
const state = readJson("_workflow/state.json");
const plan = spec.sections?.decision_runtime_integration_plan;
const historical = history.sections?.decision_runtime_integration_plan;
const errors = [];

function expect(condition, message) {
  if (!condition) errors.push(message);
}

expect(Boolean(plan), "missing active decision_runtime_integration_plan section");
expect(Boolean(historical), "missing historical decision_runtime_integration_plan section");

if (plan) {
  expect(plan.status === "plan_written_not_implemented", "unexpected active plan status");
  expect(plan.tool === "_workflow/scripts/validate_decision_runtime_integration_plan.js", "active tool path mismatch");
  expect(plan.smoke === "_tests/smoke_decision_runtime_integration_plan.js", "active smoke path mismatch");
  expect(Array.isArray(plan.integration_points) && plan.integration_points.length >= 7, "active integration points must have at least 7 items");
  expect(plan.next_gate?.runtime_patch_allowed_next === false, "runtime patch must remain disallowed");
  expect(plan.next_gate?.operator_approval_required === true, "operator approval must remain required");
  expect(plan.runtime_behavior_changed === false, "runtime behavior must remain unchanged");
  expect(plan.server_runtime_integrated === false, "server runtime must remain non-integrated");
  expect(plan.mcp_tool_exposed === false, "MCP exposure must remain false");
  expect(plan.connector_visible_change_allowed === false, "connector-visible change must remain false");
}

if (historical) {
  expect(historical.status === "plan_written_not_implemented", "unexpected historical plan status");
  expect(historical.tool === "_workflow/scripts/validate_decision_runtime_integration_plan.js", "historical tool path mismatch");
  expect(historical.smoke === "_tests/smoke_decision_runtime_integration_plan.js", "historical smoke path mismatch");
}

expect(state.status === "compact_orientation_map_not_progress_log", "state.json must remain a compact orientation map");

const result = {
  ok: errors.length === 0,
  plan_status: plan?.status ?? null,
  integration_point_count: Array.isArray(plan?.integration_points) ? plan.integration_points.length : 0,
  runtime_patch_allowed_next: plan?.next_gate?.runtime_patch_allowed_next === true,
  operator_approval_required: plan?.next_gate?.operator_approval_required === true,
  runtime_behavior_changed: plan?.runtime_behavior_changed === true,
  server_runtime_integrated: plan?.server_runtime_integrated === true,
  mcp_tool_exposed: plan?.mcp_tool_exposed === true,
  connector_visible_change_allowed: plan?.connector_visible_change_allowed === true,
  errors,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
