"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/keep_mcp_hidden_sessionless_route_retirement_package.md");
const liveRecord = read("_workflow/operator_decisions/keep_mcp_hidden_sessionless_route_live_verification.md");
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const runtimeSpec = readJson("SERVER_RUNTIME_CONFIG_SPEC.json");
const eventSpec = readJson("SERVER_EVENT_CATALOG_SPEC.json");
const dispatcher = read("src/runtime/create_server_route_dispatcher.js");
const bootstrap = read("src/runtime/server_bootstrap_runtime.js");
const assembly = read("src/runtime/runtime_context_assembly.js");
const lifecycle = read("src/runtime/server_lifecycle.js");
const factory = read("src/runtime/server_factory.js");

assert.ok(record.includes("Status: GREEN / REPO-APPLIED / RESTART PENDING"));
assert.ok(record.includes("removes `/mcp/sessionless` dispatch from active HTTP route wiring"));
assert.ok(record.includes("restart_required_now"));
assert.ok(record.includes("connector_refresh_required_now"));
assert.ok(record.includes("Perform the controlled OAuth21 `3008` restart and bounded live verification"));
assert.ok(liveRecord.includes("Status: GREEN / LIVE-VERIFIED / RESTART COMPLETED"));
assert.ok(liveRecord.includes("GET http://127.0.0.1:3008/mcp/sessionless -> 404"));

assert.equal(state.active_target_direction.hidden_sessionless_route_retirement_package_record, "_workflow/operator_decisions/keep_mcp_hidden_sessionless_route_retirement_package.md");
assert.equal(state.active_target_direction.hidden_sessionless_route_live_verification_record, "_workflow/operator_decisions/keep_mcp_hidden_sessionless_route_live_verification.md");
assert.equal(state.active_target_direction.hidden_sessionless_route_repo_retired_now, true);
assert.equal(state.current_runtime_truth.oauth21_3008.restart_required_now, false);
assert.equal(state.current_runtime_truth.oauth21_3008.sessionless_hidden_route_active, false);
assert.equal(state.current_runtime_truth.oauth21_3008.sessionless_hidden_route_repo_retired_now, true);

assert.equal(inventory.active_target_contract.hidden_sessionless_route_retirement_package_record, "_workflow/operator_decisions/keep_mcp_hidden_sessionless_route_retirement_package.md");
assert.equal(inventory.active_target_contract.hidden_sessionless_route_live_verification_record, "_workflow/operator_decisions/keep_mcp_hidden_sessionless_route_live_verification.md");
assert.equal(inventory.active_target_contract.hidden_sessionless_route_repo_retired_now, true);
assert.ok(inventory.recommended_next.some((item) => item.includes("Hidden-route retirement is now live-verified on OAuth21 3008")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Historical /mcp/sessionless live-operation artifacts are quarantined")));

assert.ok(canon.includes("Hidden-route retirement-package clarification"));
assert.ok(canon.includes("keep_mcp_hidden_sessionless_route_live_verification.md"));
assert.ok(index.includes("keep_mcp_hidden_sessionless_route_retirement_package.md"));
assert.ok(index.includes("keep_mcp_hidden_sessionless_route_live_verification.md"));

assert.equal(runtimeSpec.http_routes.includes("/mcp/sessionless"), false);
assert.equal(runtimeSpec.env_vars.includes("MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE"), false);
assert.equal(Object.hasOwn(runtimeSpec, "sessionless_prototype"), false);
assert.equal(runtimeSpec.retired_sessionless_transition.status, "retired_from_active_repo_and_live_3008");

for (const source of [dispatcher, bootstrap, assembly, lifecycle, factory]) {
  assert.equal(source.includes("sessionlessPrototypeRouteHandler"), false);
  assert.equal(source.includes("/mcp/sessionless"), false);
}

for (const name of ["sessionless_prototype_rejected", "sessionless_prototype_auth_rejected", "sessionless_prototype_parse_error", "sessionless_prototype_rpc"]) {
  assert.equal(eventSpec.events.some((item) => item.name === name), false, name);
}

assert.equal(fs.existsSync(path.join(ROOT, "src", "runtime", "sessionless_prototype_route_handler.js")), false);
assert.equal(fs.existsSync(path.join(ROOT, "src", "runtime", "state_handle_prototype.js")), true);

console.log("smoke_keep_mcp_hidden_sessionless_route_retirement_package ok");
