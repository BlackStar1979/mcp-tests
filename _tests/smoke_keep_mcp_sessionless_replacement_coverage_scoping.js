"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/keep_mcp_sessionless_replacement_coverage_scoping.md");
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const discoverHandler = read("src/runtime/server_discover_message_handler.js");
const dispatcher = read("src/runtime/rpc_message_dispatcher.js");
const runtimeSpec = readJson("SERVER_RUNTIME_CONFIG_SPEC.json");

assert.ok(record.includes("Status: GREEN / REPLACEMENT COVERAGE SCOPE RECORDED / WORKFLOW-ONLY"));
assert.ok(record.includes("Notification replacement on surviving `/mcp`"));
assert.ok(record.includes("State-handle boundary"));
assert.ok(record.includes("Prepare the final no-SSE `subscriptions/listen` contract decision for the surviving `/mcp` route."));

assert.equal(state.active_target_direction.sessionless_replacement_coverage_scoping_record, "_workflow/operator_decisions/keep_mcp_sessionless_replacement_coverage_scoping.md");
assert.equal(inventory.active_target_contract.sessionless_replacement_coverage_scoping_record, "_workflow/operator_decisions/keep_mcp_sessionless_replacement_coverage_scoping.md");
assert.ok(inventory.recommended_next.some((item) => item.includes("Replacement-coverage scoping is complete")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Pull-only runtime package is complete")));
assert.ok(inventory.recommended_next.some((item) => item.includes("State-handle fate decision is complete")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Hidden-route retirement is now live-verified on OAuth21 3008")));
assert.ok(inventory.recommended_next.some((item) => item.includes("Historical /mcp/sessionless live-operation artifacts are quarantined")));

const listenLedger = inventory.deprecation_ledger.find((item) => item.feature_id === "subscriptions_listen");
assert.equal(listenLedger.checklist.find((item) => item.item === "record surviving-route replacement scope before prototype-route retirement").status, "done");
assert.equal(listenLedger.checklist.find((item) => item.item === "record surviving-route replacement scope before prototype-route retirement").evidence, "_workflow/operator_decisions/keep_mcp_sessionless_replacement_coverage_scoping.md");

assert.ok(canon.includes("Replacement-coverage clarification"));
assert.ok(index.includes("keep_mcp_sessionless_replacement_coverage_scoping.md"));
assert.ok(index.includes("Verified cleanup/normalization closeout on `main`: `origin/main` and local `main` are at `aecec58`"));

assert.ok(dispatcher.includes('case "server/discover"'));
assert.ok(discoverHandler.includes("protocol_sessions: true"));
assert.equal(runtimeSpec.retired_sessionless_transition.status, "retired_from_active_repo_and_live_3008");

console.log("smoke_keep_mcp_sessionless_replacement_coverage_scoping ok");
