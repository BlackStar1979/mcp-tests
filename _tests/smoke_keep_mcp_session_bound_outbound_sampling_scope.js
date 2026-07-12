"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { assertWorkflowCurrentSmokeBaseline } = require("./helpers/workflow_baseline");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/keep_mcp_session_bound_outbound_sampling_scope.md");
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const manifest = readJson("_tests/run_all_smoke_scripts.json");
const sessionSource = read("src/runtime/session.js");
const outboundSource = read("src/runtime/outbound_request_manager.js");
const samplingSource = read("src/runtime/sampling_context.js");
const handlersSource = read("src/runtime/mcp_runtime_handlers.js");
const pendingCorrelationSmoke = read("_tests/smoke_pending_request_correlation.js");
const samplingRoundtripSmoke = read("_tests/smoke_sampling_roundtrip.js");
const runtimeHandlersSmoke = read("_tests/smoke_mcp_runtime_handlers.js");

assert.ok(record.includes("Status: GREEN / SCOPE RECORDED / WORKFLOW-ONLY"));
assert.ok(record.includes("`session.js`, helper-only `sendSessionRequest(...)`, and helper-level sampling roundtrip remain bounded compatibility fixtures."));
assert.ok(record.includes("`resolvePendingResponse(...)` and JSON-RPC response-envelope validation remain the only active contract-relevant part of this area."));
assert.ok(record.includes("The remaining open work here is no longer \"discover what still depends on session semantics\"."));
assert.ok(record.includes("no runtime code change"));
assert.ok(record.includes("no restart"));
assert.ok(record.includes("no connector refresh"));

assert.equal(state.active_target_direction.session_bound_outbound_sampling_scope_record, "_workflow/operator_decisions/keep_mcp_session_bound_outbound_sampling_scope.md");
assert.equal(inventory.active_target_contract.session_bound_outbound_sampling_scope_record, "_workflow/operator_decisions/keep_mcp_session_bound_outbound_sampling_scope.md");
assert.ok(inventory.recommended_next.some((item) => item.includes("Session-bound outbound/sampling scoping is complete")));

assert.ok(sessionSource.includes("Retained as a local compatibility helper; active /mcp no longer constructs transport sessions."));
assert.ok(outboundSource.includes("sendSessionRequest is helper-only debt now."));
assert.ok(samplingSource.includes("active /mcp no longer injects this into request context."));
assert.equal(handlersSource.includes("sampling_context"), false);
assert.equal(handlersSource.includes("enrichContextWithSampling"), false);

assert.ok(pendingCorrelationSmoke.includes("new McpSession"));
assert.ok(pendingCorrelationSmoke.includes("sendSessionRequest(session"));
assert.ok(samplingRoundtripSmoke.includes("createSamplingContext"));
assert.ok(samplingRoundtripSmoke.includes("resolvePendingResponse"));
assert.equal(runtimeHandlersSmoke.includes('assert.equal(handlers.includes("sampling_context"),false);'), true);

assertWorkflowCurrentSmokeBaseline({ canon, index });
assert.ok(canon.includes("Session-bound outbound/sampling scoping clarification"));
assert.ok(index.includes("keep_mcp_session_bound_outbound_sampling_scope.md"));
assert.ok(manifest.includes("_tests/smoke_keep_mcp_session_bound_outbound_sampling_scope.js"));

console.log("smoke_keep_mcp_session_bound_outbound_sampling_scope ok");
