"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/connector_reconnect_execution_evidence.md");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const manifest = readJson("_tests/run_all_smoke_scripts.json");
const connectorSpec = readJson("SERVER_CONNECTOR_SURFACE_SPEC.json");
const state = readJson("_workflow/state.json");

assert.ok(record.includes("Status: GREEN / OPERATOR UI STEP EXECUTED / 43 TOOLS CONFIRMED"));
assert.ok(record.includes("Historical status note: this record is transition-route evidence only."));
assert.ok(record.includes("It is superseded as active target guidance by `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md`"));
assert.ok(record.includes("Do not use it as the current next-step plan."));
assert.ok(record.includes("The existing authenticated connector was removed in the Codex UI."));
assert.ok(record.includes("The authenticated connector was added again in the Codex UI."));
assert.ok(record.includes("The UI displayed an authentication prompt."));
assert.ok(record.includes("The operator entered the OAuth password in the new window."));
assert.ok(record.includes("The connector accepted the password."));
assert.ok(record.includes("Claude Code connector UI confirmed `43` visible tools."));
assert.ok(record.includes("Final visible tool count is confirmed at `43`."));
assert.ok(record.includes("Historical closeout at that time: S15 was closed as connector reconnect evidence on stable `/mcp`."));
assert.ok(record.includes("This record is no longer an active instruction source; current target authority is the single-route no-SSE plan on surviving `/mcp`."));

assert.equal(connectorSpec.oauth21_connector.mcp_endpoint, "https://mcp-tests-oauth21.romionologic.dev/mcp");
assert.equal(connectorSpec.oauth21_connector.path, "/mcp");
assert.equal(state.current_connector_truth.oauth21_3008_tools.tool_count, 43);
assert.equal(state.current_connector_truth.oauth21_3008_tools.tool_names_hash, "8b62ecaf89227335");

assert.equal(inventory.target_selection_readiness.s15_connector_reconnect_execution_evidence.status, "confirmed_43_tools_auth_prompt_accepted");
assert.equal(inventory.target_selection_readiness.s15_connector_reconnect_execution_evidence.record, "_workflow/operator_decisions/connector_reconnect_execution_evidence.md");
assert.equal(inventory.target_selection_readiness.s15_connector_reconnect_execution_evidence.guard, "_tests/smoke_connector_reconnect_execution_evidence.js");
assert.equal(inventory.target_selection_readiness.s15_connector_reconnect_execution_evidence.stable_connector_target, "/mcp");
assert.equal(inventory.target_selection_readiness.s15_connector_reconnect_execution_evidence.auth_prompt_observed, true);
assert.equal(inventory.target_selection_readiness.s15_connector_reconnect_execution_evidence.password_accepted, true);
assert.equal(inventory.target_selection_readiness.s15_connector_reconnect_execution_evidence.final_visible_tool_count_confirmed, true);
assert.equal(inventory.target_selection_readiness.s15_connector_reconnect_execution_evidence.final_visible_tool_count, 43);
assert.equal(inventory.target_selection_readiness.s15_connector_reconnect_execution_evidence.visible_tool_groups.read_only_internal_create, 40);
assert.equal(inventory.target_selection_readiness.s15_connector_reconnect_execution_evidence.visible_tool_groups.write_delete, 3);

assert.ok(canon.includes("Latest known full smoke: `node ./_tests/run_all_smokes.js --skip-network = ok_0_40_0_7_210`"));
assert.ok(canon.includes("Latest validated authenticated smoke count: `210`"));
assert.ok(canon.includes("S15 connector reconnect execution evidence on stable `/mcp` green"));
assert.ok(index.includes("Latest full smoke after historical-next-step quarantine guard: `ok_0_40_0_7_210`."));
assert.ok(index.includes("Authenticated smoke count: `210`."));
assert.ok(index.includes("connector_reconnect_execution_evidence.md"));
assert.ok(index.includes("Teardown package for `GET /mcp` SSE, `Last-Event-ID`, and stable stream-path replay semantics."));
assert.ok(manifest.includes("_tests/smoke_connector_reconnect_execution_evidence.js"));

console.log("smoke_connector_reconnect_execution_evidence ok");
