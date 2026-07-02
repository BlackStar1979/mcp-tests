"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/sessionless_prototype_route_retirement_scoping.md");
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const dispatcher = read("src/runtime/create_server_route_dispatcher.js");
const runtimeSpec = readJson("SERVER_RUNTIME_CONFIG_SPEC.json");

assert.ok(record.includes("Status: GREEN / SCOPING RECORDED / WORKFLOW-ONLY"));
assert.ok(record.includes("`/mcp/sessionless`"));
assert.ok(record.includes("MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE"));
assert.ok(record.includes("Confirmed blockers to actual retirement"));
assert.ok(record.includes("Final no-SSE notification replacement is still not defined."));
assert.ok(record.includes("Prepare the final initialize-retirement boundary decision for the surviving `/mcp` route."));

assert.equal(state.active_target_direction.sessionless_prototype_route_retirement_scoping_record, "_workflow/operator_decisions/sessionless_prototype_route_retirement_scoping.md");
assert.equal(inventory.active_target_contract.sessionless_prototype_route_retirement_scoping_record, "_workflow/operator_decisions/sessionless_prototype_route_retirement_scoping.md");
assert.ok(inventory.recommended_next.some((item) => item.includes("Initialize-retirement boundary is complete")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Replacement-coverage scoping is complete")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Hidden-route retirement is now live-verified on OAuth21 3008")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Historical /mcp/sessionless live-operation artifacts are quarantined")));

assert.ok(canon.includes("Prototype-route retirement clarification"));
assert.ok(index.includes("sessionless_prototype_route_retirement_scoping.md"));
assert.ok(index.includes("Verified cleanup/normalization closeout on `main`: `origin/main` and local `main` are at `aecec58`"));

assert.equal(dispatcher.includes('url.pathname === "/mcp/sessionless"'), false);
assert.equal(runtimeSpec.http_routes.includes("/mcp/sessionless"), false);
assert.equal(runtimeSpec.retired_sessionless_transition.status, "retired_from_active_repo_and_live_3008");

console.log("smoke_sessionless_prototype_route_retirement_scoping ok");
