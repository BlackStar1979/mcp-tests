"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/connector_refresh_approval_package.md");
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const manifest = readJson("_tests/run_all_smoke_scripts.json");
const connectorSpec = readJson("SERVER_CONNECTOR_SURFACE_SPEC.json");

assert.ok(record.includes("Status: GREEN / APPROVAL PACKAGE PREPARED / NO CONNECTOR EXECUTION"));
assert.ok(record.includes("Historical status note: this record is transition-route evidence only."));
assert.ok(record.includes("It is superseded as active target guidance by `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md`"));
assert.ok(record.includes("Do not use it as the current next-step plan."));
assert.ok(record.includes("Codex UI does not expose a separate refresh button"));
assert.ok(record.includes("the practical refresh-equivalent action is:"));
assert.ok(record.includes("Remove the existing authenticated TEST MCP connector in the Codex UI."));
assert.ok(record.includes("Add the authenticated connector again, targeting the current stable endpoint."));
assert.ok(record.includes("This package does not assume that an OAuth/password prompt must appear."));
assert.ok(record.includes("Connector target: `https://mcp-tests-oauth21.romionologic.dev/mcp`"));
assert.ok(record.includes("Sessionless route must not be used as the connector target in this package."));
assert.ok(record.includes("No connector removal was performed by repo code."));
assert.ok(record.includes("No connector add was performed by repo code."));
assert.ok(record.includes("Preferred S15: connector reconnect execution evidence on stable `/mcp` using operator-driven remove + add in the Codex UI."));

assert.equal(connectorSpec.oauth21_connector.mcp_endpoint, "https://mcp-tests-oauth21.romionologic.dev/mcp");
assert.equal(connectorSpec.oauth21_connector.path, "/mcp");
assert.equal(connectorSpec.authenticated_connector.current_tool_count_after_stage6, 43);

assert.equal(state.current_connector_truth.oauth21_3008_tools.tool_count, 43);
assert.equal(state.current_connector_truth.oauth21_3008_tools.tool_names_hash, "8b62ecaf89227335");
assert.equal(state.current_connector_truth.oauth21_3008_tools.connector_map_status, "in_sync_43_of_43");

assert.equal(inventory.target_selection_readiness.s14_connector_refresh_approval_package.status, "prepared_no_execution");
assert.equal(inventory.target_selection_readiness.s14_connector_refresh_approval_package.record, "_workflow/operator_decisions/connector_refresh_approval_package.md");
assert.equal(inventory.target_selection_readiness.s14_connector_refresh_approval_package.guard, "_tests/smoke_connector_refresh_approval_package.js");
assert.equal(inventory.target_selection_readiness.s14_connector_refresh_approval_package.connector_refresh_required_now, false);
assert.equal(inventory.target_selection_readiness.s14_connector_refresh_approval_package.runtime_restart_required_now, false);
assert.equal(inventory.target_selection_readiness.s14_connector_refresh_approval_package.public_3009_start_required_now, false);
assert.equal(inventory.target_selection_readiness.s14_connector_refresh_approval_package.connector_execution_performed_now, false);
assert.equal(inventory.target_selection_readiness.s14_connector_refresh_approval_package.stable_connector_target, "/mcp");
assert.equal(inventory.target_selection_readiness.s14_connector_refresh_approval_package.operator_ui_refresh_equivalent, "remove_and_add_connector");
assert.equal(inventory.target_selection_readiness.s14_connector_refresh_approval_package.historical_next_recommended_step, "S15 connector reconnect execution evidence on stable /mcp");
assert.equal(inventory.target_selection_readiness.s14_connector_refresh_approval_package.next_recommended_step, "single-route no-SSE streamable-HTTP target contract and migration plan");
assert.equal(inventory.target_selection_readiness.s14_connector_refresh_approval_package.superseded_by_current_active_queue, true);

assert.ok(canon.includes("Latest known full smoke: `node ./_tests/run_all_smokes.js --skip-network = ok_0_40_0_7_209`"));
assert.ok(canon.includes("Latest validated authenticated smoke count: `209`"));
assert.ok(canon.includes("S14 connector refresh approval package / no execution green"));
assert.ok(canon.includes("S15 connector reconnect execution evidence on stable `/mcp`"));
assert.ok(index.includes("Latest full smoke after state-and-snapshot hygiene guard: `ok_0_40_0_7_209`."));
assert.ok(index.includes("Authenticated smoke count: `209`."));
assert.ok(index.includes("connector_refresh_approval_package.md"));
assert.ok(index.includes("Teardown package for `GET /mcp` SSE, `Last-Event-ID`, and stable stream-path replay semantics."));

assert.ok(manifest.includes("_tests/smoke_connector_refresh_approval_package.js"));

console.log("smoke_connector_refresh_approval_package ok");

