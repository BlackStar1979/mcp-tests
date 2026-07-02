const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const state = JSON.parse(fs.readFileSync(path.join(ROOT, "_workflow", "state.json"), "utf8"));
const plan = fs.readFileSync(path.join(ROOT, "_workflow", "operator_decisions", "stage14_7_tools_list_cache_diagnostics_plan.md"), "utf8");
const index = fs.readFileSync(path.join(ROOT, "_workflow", "ACTIVE_WORKFLOW_INDEX.md"), "utf8");
const canon = fs.readFileSync(path.join(ROOT, "_workflow", "WORKFLOW_CANON.md"), "utf8");

const expectedStatus = "d1a_d1b_d1c_repo_applied_live_validated_refresh_observed";
const expectedFingerprint = "f43a3eed6fb79bb6";
const expectedHash = "8b62ecaf89227335";
const expectedStart = "2026-06-28T16:18:17.295Z";

const c = state.current_connector_truth.oauth21_3008_tools;
assert.equal(c.connector_map_status, "in_sync_43_of_43");
assert.equal(typeof state.current_runtime_truth.oauth21_3008.server_start_id, "string");
assert.equal(state.current_runtime_truth.oauth21_3008.server_start_id.length > 0, true);
assert.equal(c.combined_fingerprint, expectedFingerprint);
assert.equal(c.tool_names_hash, expectedHash);
assert.equal(c.tool_count, 43);
assert.equal(c.connector_refresh_required_now, false);
assert.equal(c.last_tools_list_request_id, "mqy1eq6w-10");
assert.equal(state.current_runtime_truth.oauth21_3008.restart_required_now, true);
assert.equal(c.connector_refresh_required_now, false);
assert.equal(Object.hasOwn(state, "active_planned_work"), false);
assert.equal(Object.hasOwn(state, "tools_list_cache_diagnostics"), false);

assert.ok(plan.includes("Status: D1-A/D1-B/D1-C REPO APPLIED / LIVE VALIDATED ON TESTS_MCP 3008"));
assert.ok(plan.includes(expectedFingerprint));
assert.ok(plan.includes(expectedHash));
assert.ok(plan.includes("Connector-visible map comparison is `in_sync` at `43/43`"));
assert.ok(index.includes("repo-applied/live-validated"));
assert.ok(index.includes("connector-visible map is in sync 43/43"));
assert.ok(canon.includes("D1-A/D1-B/D1-C repo-applied and live-validated on TESTS_MCP 3008"));
assert.ok(canon.includes("Stage 14.7 D1 observation is closed"));

console.log("smoke_tools_list_cache_live_validation ok");
