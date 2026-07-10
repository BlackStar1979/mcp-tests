const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const state = JSON.parse(fs.readFileSync(path.join(ROOT, "_workflow", "state.json"), "utf8"));
const plan = fs.readFileSync(path.join(ROOT, "_workflow", "operator_decisions", "stage14_7_tools_list_cache_diagnostics_plan.md"), "utf8");
const index = fs.readFileSync(path.join(ROOT, "_workflow", "ACTIVE_WORKFLOW_INDEX.md"), "utf8");
const canon = fs.readFileSync(path.join(ROOT, "_workflow", "WORKFLOW_CANON.md"), "utf8");

const expectedCurrentStatus = "live_healthz_and_startup_inventory_69_repo_expected_69_connector_ui_visibility_unverified";
const expectedCurrentFingerprint = "572ac8dc00c58410";
const expectedCurrentHash = "3a69d810619b2b97";

const c = state.current_connector_truth.oauth21_3008_tools;
assert.equal(c.connector_map_status, expectedCurrentStatus);
assert.equal(typeof state.current_runtime_truth.oauth21_3008.server_start_id, "string");
assert.equal(state.current_runtime_truth.oauth21_3008.server_start_id.length > 0, true);
assert.equal(c.combined_fingerprint, expectedCurrentFingerprint);
assert.equal(c.tool_names_hash, expectedCurrentHash);
assert.equal(c.tool_count, 69);
assert.equal(c.repo_current_expected_tool_count, 69);
assert.equal(c.connector_refresh_required_now, false);
assert.equal(c.connector_ui_visibility_verified_now, false);
assert.equal(state.current_runtime_truth.oauth21_3008.restart_required_now, false);
assert.equal(Object.hasOwn(state, "active_planned_work"), false);
assert.equal(Object.hasOwn(state, "tools_list_cache_diagnostics"), false);

assert.ok(plan.includes("Status: D1-A/D1-B/D1-C REPO APPLIED / LIVE VALIDATED ON TESTS_MCP 3008"));
assert.ok(plan.includes("f43a3eed6fb79bb6"));
assert.ok(plan.includes("8b62ecaf89227335"));
assert.ok(plan.includes("Connector-visible map comparison is `in_sync` at `43/43`"));
assert.ok(index.includes("repo truth now expects `69` connector-visible authenticated tools"));
assert.ok(index.includes("startup inventory confirm `69` live tools"));
assert.ok(index.includes("visible-tool enumeration is still not independently re-verified"));
assert.ok(canon.includes("Repo current connector-visible authenticated tool target is `69`"));
assert.ok(canon.includes("tool count `69`"));
assert.ok(canon.includes("not a fresh UI inventory proof"));

console.log("smoke_tools_list_cache_live_validation ok");
