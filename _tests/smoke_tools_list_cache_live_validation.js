const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const state = JSON.parse(fs.readFileSync(path.join(ROOT, "_workflow", "state.json"), "utf8"));
const plan = fs.readFileSync(path.join(ROOT, "_workflow", "operator_decisions", "stage14_7_tools_list_cache_diagnostics_plan.md"), "utf8");
const index = fs.readFileSync(path.join(ROOT, "_workflow", "ACTIVE_WORKFLOW_INDEX.md"), "utf8");
const canon = fs.readFileSync(path.join(ROOT, "_workflow", "WORKFLOW_CANON.md"), "utf8");
const descriptorReview = fs.readFileSync(
  path.join(ROOT, "_workflow", "operator_decisions", "descriptor_refresh_impact_review.md"),
  "utf8",
);

const expectedCurrentStatus = "repo89_runtime89_model85_reenumeration_pending";
const expectedCurrentFingerprint = "73c0bc08dad53e8c";
const expectedCurrentHash = "7b5bfc1bd21386d3";

const c = state.current_connector_truth.oauth21_3008_tools;
const currentServerStartId = state.current_runtime_truth.oauth21_3008.server_start_id;
assert.equal(c.connector_map_status, expectedCurrentStatus);
assert.match(currentServerStartId, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
assert.equal(c.server_start_id, currentServerStartId);
assert.equal(c.combined_fingerprint, expectedCurrentFingerprint);
assert.equal(c.tool_names_hash, expectedCurrentHash);
assert.equal(c.tool_count, 85);
assert.equal(c.repo_current_expected_tool_count, 89);
assert.equal(c.connector_refresh_required_now, true);
assert.equal(c.connector_ui_visibility_verified_now, false);
assert.equal(c.model_runtime_callable_verified_now, true);
assert.equal(state.current_runtime_truth.oauth21_3008.restart_required_now, false);
assert.equal(state.current_runtime_truth.oauth21_3008.cbm_contract, "live_hardened_v0_9_0_89_with_upstream_201_277_caveats_and_snippet_integrity");
assert.equal(Object.hasOwn(state, "active_planned_work"), false);
assert.equal(Object.hasOwn(state, "tools_list_cache_diagnostics"), false);

assert.ok(plan.includes("Status: D1-A/D1-B/D1-C REPO APPLIED / LIVE VALIDATED ON TESTS_MCP 3008"));
assert.ok(plan.includes("f43a3eed6fb79bb6"));
assert.ok(plan.includes("8b62ecaf89227335"));
assert.ok(plan.includes("Connector-visible map comparison is `in_sync` at `43/43`"));
assert.ok(index.includes("repository and live OAuth21 `3008` both serve the `89`-tool target"));
assert.ok(index.includes("repository/live target `89`"));
assert.ok(index.includes("startup `85`-tool map"));
assert.ok(index.includes("the 85-tool task-lifecycle deployment is complete"));
assert.ok(!index.includes("current live and repository surface 84 connector-visible tools"));
assert.ok(!index.includes("finish the controlled 85-tool task-lifecycle deployment"));
assert.ok(index.includes("Refreshed `COMP-1A` on August 2, 2026"));
assert.ok(index.includes("`codex-mcp-client 0.146.0-alpha.9.2` remains `initialize_only` with `2` matching legacy entries and `0` `server/discover` entries"));
assert.ok(index.includes("canonical PKCE"));
assert.ok(index.includes("No OAuth relogin is required"));
assert.ok(index.includes("routes documentation/workflow questions to the dependency-free knowledge index"));
assert.ok(index.includes("knowledge index"));
assert.ok(canon.includes("Repo current connector-visible authenticated tool target is `89`"));
assert.ok(canon.includes("already-open Codex task retains its startup `85`-tool map"));
assert.ok(canon.includes("CBM reliability hardening is live"));
assert.ok(canon.includes("descriptor review is closed without manual connector refresh"));
assert.ok(descriptorReview.includes("Status: GREEN / CURRENT CODEX CLIENT FETCHED CURRENT DESCRIPTORS / NO MANUAL CONNECTOR REFRESH REQUIRED"));
assert.ok(descriptorReview.includes("codex-mcp-client 0.146.0-alpha.9.2"));
assert.ok(descriptorReview.includes("Descriptor fingerprint: `26f35b84a92470b8`"));
assert.ok(descriptorReview.includes("Combined fingerprint: `673f28e12afea85c`"));
assert.ok(descriptorReview.includes("connector_refresh_required_now = false"));

console.log("smoke_tools_list_cache_live_validation ok");
