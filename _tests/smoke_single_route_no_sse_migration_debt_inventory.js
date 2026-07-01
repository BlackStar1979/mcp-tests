"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/single_route_no_sse_migration_debt_inventory.md");
const runtimeSpec = readJson("SERVER_RUNTIME_CONFIG_SPEC.json");
const serverSpec = readJson("SERVER_SPEC.json");
const connectorSpec = readJson("SERVER_CONNECTOR_SURFACE_SPEC.json");
const eventSpec = readJson("SERVER_EVENT_CATALOG_SPEC.json");

for (const item of [
  "src/runtime/accept_policy.js",
  "src/runtime/mcp_entry_dispatcher.js",
  "src/runtime/mcp_get_stream_handler.js",
  "src/runtime/create_server_route_dispatcher.js",
  "src/runtime/sessionless_prototype_route_handler.js",
  "src/runtime/sse_response.js",
]) {
  assert.ok(record.includes(item), item);
}
assert.ok(record.includes("stricter project target"));
assert.ok(record.includes("still allows request-scoped SSE"));

assert.equal(runtimeSpec.retired_sessionless_transition.status, "retired_from_active_repo_and_live_3008");
assert.equal(runtimeSpec.retired_sessionless_transition.historical_only, true);
assert.equal(runtimeSpec.retired_sessionless_transition.restart_required_now, false);

for (const spec of [serverSpec, connectorSpec, eventSpec, runtimeSpec]) {
  assert.equal(spec.sessionless_ready_review.sessionless_transition_route, "/mcp/sessionless");
  assert.equal(spec.sessionless_ready_review.sessionless_transition_route_historical_only, true);
  assert.equal(spec.sessionless_ready_review.sessionless_transition_route_retired_from_active_runtime, true);
  assert.equal(spec.sessionless_ready_review.single_route_no_sse_target_record, "_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md");
}

console.log("smoke_single_route_no_sse_migration_debt_inventory ok");
