const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const state = JSON.parse(fs.readFileSync(path.join(ROOT, "_workflow", "state.json"), "utf8"));
const plan = fs.readFileSync(path.join(ROOT, "_workflow", "operator_decisions", "stage14_7_tools_list_cache_diagnostics_plan.md"), "utf8");
const index = fs.readFileSync(path.join(ROOT, "_workflow", "ACTIVE_WORKFLOW_INDEX.md"), "utf8");
const canon = fs.readFileSync(path.join(ROOT, "_workflow", "WORKFLOW_CANON.md"), "utf8");

const expectedCurrentStatus = "live_authenticated_tools_list_82_matches_repo_expected_82_connector_ui_visibility_unverified";
const expectedCurrentFingerprint = "7996c0640f1c9039";
const expectedCurrentHash = "5b582591966cff61";

const c = state.current_connector_truth.oauth21_3008_tools;
assert.equal(c.connector_map_status, expectedCurrentStatus);
assert.equal(typeof state.current_runtime_truth.oauth21_3008.server_start_id, "string");
assert.equal(state.current_runtime_truth.oauth21_3008.server_start_id.length > 0, true);
assert.equal(c.combined_fingerprint, expectedCurrentFingerprint);
assert.equal(c.tool_names_hash, expectedCurrentHash);
assert.equal(c.tool_count, 82);
assert.equal(c.repo_current_expected_tool_count, 82);
assert.equal(c.connector_refresh_required_now, false);
assert.equal(c.connector_ui_visibility_verified_now, false);
assert.equal(state.current_runtime_truth.oauth21_3008.restart_required_now, false);
assert.equal(Object.hasOwn(state, "active_planned_work"), false);
assert.equal(Object.hasOwn(state, "tools_list_cache_diagnostics"), false);

assert.ok(plan.includes("Status: D1-A/D1-B/D1-C REPO APPLIED / LIVE VALIDATED ON TESTS_MCP 3008"));
assert.ok(plan.includes("f43a3eed6fb79bb6"));
assert.ok(plan.includes("8b62ecaf89227335"));
assert.ok(plan.includes("Connector-visible map comparison is `in_sync` at `43/43`"));
assert.ok(index.includes("repo truth expects `82` authenticated tools"));
assert.ok(index.includes("live authenticated runtime + `tools/list` now confirms 82 tools"));
assert.ok(index.includes("visible-tool enumeration is still not independently re-verified"));
assert.ok(canon.includes("Repo current authenticated tool target after the bounded modular unsafe-governance batch plus science parity package: `82`"));
assert.ok(canon.includes("Live OAuth21 `3008` is reconciled to the authenticated `/mcp` tool count `82`"));
assert.ok(canon.includes("not a fresh UI inventory proof"));

console.log("smoke_tools_list_cache_live_validation ok");
