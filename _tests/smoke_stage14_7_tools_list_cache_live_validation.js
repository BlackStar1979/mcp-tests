const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const state = JSON.parse(fs.readFileSync(path.join(ROOT, "_workflow", "state.json"), "utf8"));
const plan = fs.readFileSync(path.join(ROOT, "_workflow", "operator_decisions", "stage14_7_tools_list_cache_diagnostics_plan.md"), "utf8");
const index = fs.readFileSync(path.join(ROOT, "_workflow", "ACTIVE_WORKFLOW_INDEX.md"), "utf8");
const canon = fs.readFileSync(path.join(ROOT, "_workflow", "WORKFLOW_CANON.md"), "utf8");

const expectedStatus = "d1a_d1b_d1c_repo_applied_live_validated_refresh_observed";
const expectedFingerprint = "476c7d832021acb9";
const expectedHash = "8b62ecaf89227335";
const expectedStart = "2026-06-28T16:18:17.295Z";

assert.equal(state.tools_list_cache_diagnostics.status, expectedStatus);
assert.equal(state.tools_list_cache_diagnostics.live_server_start_id, expectedStart);
assert.equal(state.tools_list_cache_diagnostics.live_tool_surface_fingerprint, expectedFingerprint);
assert.equal(state.tools_list_cache_diagnostics.live_tool_names_hash, expectedHash);
assert.equal(state.tools_list_cache_diagnostics.live_tool_count, 43);
assert.equal(state.tools_list_cache_diagnostics.connector_map_status, "in_sync_43_of_43");
assert.equal(state.tools_list_cache_diagnostics.host_cache_status, "manual_connector_refresh_observed_tools_list_for_current_start");
assert.equal(state.tools_list_cache_diagnostics.last_observed_tools_list_request_id, "mqy1eq6w-10");
assert.match(state.tools_list_cache_diagnostics.runtime_restart_required, /^not required/);
assert.ok(state.tools_list_cache_diagnostics.connector_refresh_required.includes("not required for current unchanged surface"));
assert.equal(state.active_planned_work.find((item) => item.id === "stage14_7_tools_list_cache_diagnostics").status, expectedStatus);

assert.ok(plan.includes("Status: D1-A/D1-B/D1-C REPO APPLIED / LIVE VALIDATED ON TESTS_MCP 3008"));
assert.ok(plan.includes(expectedFingerprint));
assert.ok(plan.includes(expectedHash));
assert.ok(plan.includes("Connector-visible map comparison is `in_sync` at `43/43`"));
assert.ok(index.includes("repo-applied/live-validated"));
assert.ok(index.includes("connector-visible map is in sync 43/43"));
assert.ok(canon.includes("D1-A/D1-B/D1-C repo-applied and live-validated on TESTS_MCP 3008"));
assert.ok(canon.includes("Stage 14.7 D1 observation is closed"));

console.log("smoke_stage14_7_tools_list_cache_live_validation ok");
