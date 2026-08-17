"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { assertWorkflowCurrentSmokeBaseline } = require("./helpers/workflow_baseline");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const recordPath = "_workflow/operator_decisions/deprecated_sampling_helper_retirement_closeout.md";
const record = read(recordPath);
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const readiness = read("_workflow/READINESS.md");
const roadmap = read("_workflow/ROADMAP.md");
const manifest = readJson("_tests/run_all_smoke_scripts.json");
const outboundSource = read("src/runtime/outbound_request_manager.js");
const singleSource = read("src/runtime/single_payload_dispatcher.js");
const batchSource = read("src/runtime/batch_payload_dispatcher.js");

assert.ok(record.includes("Status: GREEN / RUNTIME CLEANUP COMPLETE"));
assert.ok(record.includes("MCP 2026-07-28"));
assert.ok(record.includes("classic Sampling is deprecated"));
assert.ok(record.includes("server_initiated_requests_not_active"));
assert.ok(record.includes("runtime restart required"));
assert.ok(record.includes("connector refresh not required"));

assert.equal(fs.existsSync(path.join(ROOT, "src/runtime/session.js")), false);
assert.equal(fs.existsSync(path.join(ROOT, "src/runtime/sampling_context.js")), false);
assert.equal(outboundSource.includes("sendSessionRequest"), false);
assert.equal(outboundSource.includes("resolvePendingResponse"), false);
assert.ok(singleSource.includes("client_response_envelope_rejected"));
assert.ok(batchSource.includes("client_response_envelope_rejected"));

assert.equal(state.active_target_direction.deprecated_sampling_helper_retirement_closeout_record, recordPath);
assert.equal(inventory.active_target_contract.deprecated_sampling_helper_retirement_closeout_record, recordPath);
assert.ok(inventory.recommended_next.some((item) => item.includes("Session-bound outbound/sampling helper debt is retired")));
assert.match(readiness, /\| DEBT-1 \| Session-bound outbound\/sampling helper debt \| 4\/4 \|/);
assert.ok(roadmap.includes("DEBT-1-RETIREMENT"));

assertWorkflowCurrentSmokeBaseline({ canon, index });
assert.ok(canon.includes("Deprecated sampling helper retirement closeout"));
assert.ok(index.includes("deprecated_sampling_helper_retirement_closeout.md"));
assert.ok(manifest.includes("_tests/smoke_keep_mcp_session_bound_outbound_sampling_scope.js"));

console.log("smoke_keep_mcp_session_bound_outbound_sampling_scope ok");
