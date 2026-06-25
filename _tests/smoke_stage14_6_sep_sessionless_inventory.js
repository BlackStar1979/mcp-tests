const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const inventoryPath = path.join(ROOT, "_workflow", "sessionless_inventory.json");
const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));

assert.equal(inventory.schema_version, "stage14_6-sep-driven-sessionless-inventory-v1");
assert.equal(inventory.status, "sep_driven_living_checklist_no_runtime_change");
assert.ok(Array.isArray(inventory.authority_chain));
for (const required of [
  "_workflow/README.md",
  "_workflow/ACTIVE_WORKFLOW_INDEX.md",
  "_workflow/state.json",
  "_workflow/WORKFLOW_CANON.md",
  "_workflow/operator_decisions/post_stage6_operator_decisions_2026-06-21.md",
  "_workflow/sessionless_inventory.json",
]) {
  assert.ok(inventory.authority_chain.includes(required), `missing authority chain item: ${required}`);
}

assert.equal(inventory.source_verification.last_verified_date, "2026-06-25");
const seps = new Set(inventory.source_verification.tracked_final_seps.map((item) => item.sep));
for (const sep of ["SEP-2549", "SEP-2567", "SEP-2575", "SEP-2577", "SEP-2596"]) {
  assert.ok(seps.has(sep), `missing tracked SEP: ${sep}`);
}
for (const item of inventory.source_verification.tracked_final_seps) {
  assert.equal(item.status, "Final", `${item.sep} must be tracked as Final`);
  assert.match(item.url, /^https:\/\/modelcontextprotocol\.io\/seps\//, `${item.sep} must cite official SEP URL`);
}

const ledger = new Map(inventory.deprecation_ledger.map((item) => [item.feature_id, item]));
for (const required of [
  "initialize_handshake",
  "mcp_session_id_header",
  "session_store",
  "get_mcp_sse_stream",
  "subscriptions_listen",
  "delete_mcp_teardown",
  "request_cancellation",
  "resumable_sse_last_event_id",
  "list_results_ttl_cache_scope",
  "dynamic_list_lifecycle_hotplug",
  "roots_sampling_logging_deprecation",
  "feature_lifecycle_deprecation_policy",
  "restart_resilience",
  "runtime_policy_scope_matrix",
]) {
  assert.ok(ledger.has(required), `missing ledger item: ${required}`);
}

const allowedStatus = new Set(inventory.status_values);
const allowedLifecycle = new Set(inventory.feature_lifecycle_values);
for (const item of inventory.deprecation_ledger) {
  assert.ok(item.feature_id, "feature_id required");
  assert.ok(Array.isArray(item.sep_sources) && item.sep_sources.length > 0, `${item.feature_id} needs sep_sources`);
  assert.ok(allowedLifecycle.has(item.target_lifecycle), `${item.feature_id} has invalid lifecycle ${item.target_lifecycle}`);
  assert.ok(allowedStatus.has(item.implementation_status), `${item.feature_id} has invalid status ${item.implementation_status}`);
  assert.ok(item.migration_path && typeof item.migration_path === "string", `${item.feature_id} needs migration_path`);
  assert.ok(Array.isArray(item.checklist) && item.checklist.length > 0, `${item.feature_id} needs checklist`);
  for (const check of item.checklist) {
    assert.ok(check.item, `${item.feature_id} checklist item missing text`);
    assert.ok(allowedStatus.has(check.status), `${item.feature_id} checklist invalid status ${check.status}`);
  }
}

assert.deepEqual(ledger.get("initialize_handshake").sep_sources, ["SEP-2575", "SEP-2596"]);
assert.ok(ledger.get("mcp_session_id_header").sep_sources.includes("SEP-2567"));
assert.ok(ledger.get("list_results_ttl_cache_scope").sep_sources.includes("SEP-2549"));
assert.ok(ledger.get("roots_sampling_logging_deprecation").sep_sources.includes("SEP-2577"));
assert.equal(ledger.get("restart_resilience").implementation_status, "pending");
assert.match(ledger.get("restart_resilience").repo_current_model, /3008 OAuth21/);
assert.match(ledger.get("restart_resilience").repo_current_model, /3009 false closeout corrected/);

assert.ok(inventory.recommended_next.some((item) => item.includes("file-triggered restart authority")));
assert.ok(inventory.recommended_next.some((item) => item.includes("SEP-2549 TTL/cacheScope")));

assert.equal(inventory.source_verification.official_final_count, 41);
assert.equal(inventory.coverage_summary.total_final_seps, 41);
assert.equal(inventory.coverage_summary.unclassified, 0);
assert.ok(Array.isArray(inventory.all_seps_index));
assert.equal(inventory.all_seps_index.length, 41);
const allSepIds = new Set(inventory.all_seps_index.map((item) => item.sep));
for (const sep of [
  "SEP-2663", "SEP-2596", "SEP-2577", "SEP-2575", "SEP-2567", "SEP-2549", "SEP-2484", "SEP-2468", "SEP-2322", "SEP-2260", "SEP-2243", "SEP-2207", "SEP-2164", "SEP-2149", "SEP-2148", "SEP-2133", "SEP-2106", "SEP-2085", "SEP-1865", "SEP-1850", "SEP-1730", "SEP-1699", "SEP-1686", "SEP-1613", "SEP-1577", "SEP-1330", "SEP-1319", "SEP-1303", "SEP-1302", "SEP-1046", "SEP-1036", "SEP-1034", "SEP-1024", "SEP-994", "SEP-991", "SEP-990", "SEP-986", "SEP-985", "SEP-973", "SEP-932", "SEP-414"
]) {
  assert.ok(allSepIds.has(sep), `missing all-SEPs coverage entry: ${sep}`);
}
for (const entry of inventory.all_seps_index) {
  assert.equal(entry.status, "Final", `${entry.sep} must be Final`);
  assert.ok(entry.impact_bucket, `${entry.sep} needs impact_bucket`);
  assert.notEqual(entry.impact_bucket, "unclassified", `${entry.sep} must be classified`);
  assert.ok(entry.inventory_action, `${entry.sep} needs inventory_action`);
}

console.log("smoke_stage14_6_sep_sessionless_inventory ok");
