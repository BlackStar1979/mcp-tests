const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { EXPECTED: SURFACE } = require("../src/truth/project_truth_audit");

const ROOT = path.resolve(__dirname, "..");
const state = JSON.parse(fs.readFileSync(path.join(ROOT, "_workflow", "state.json"), "utf8"));
const plan = fs.readFileSync(path.join(ROOT, "_workflow", "operator_decisions", "stage14_7_tools_list_cache_diagnostics_plan.md"), "utf8");
const index = fs.readFileSync(path.join(ROOT, "_workflow", "ACTIVE_WORKFLOW_INDEX.md"), "utf8");
const canon = fs.readFileSync(path.join(ROOT, "_workflow", "WORKFLOW_CANON.md"), "utf8");
const descriptorReview = fs.readFileSync(
  path.join(ROOT, "_workflow", "operator_decisions", "descriptor_refresh_impact_review.md"),
  "utf8",
);

const expectedCurrentStatus = "repo98_runtime98_model98_aligned";
const expectedCurrentFingerprint = SURFACE.combined_fingerprint;
const expectedCurrentHash = SURFACE.tool_names_hash;

const c = state.current_connector_truth.oauth21_3008_tools;
const currentServerStartId = state.current_runtime_truth.oauth21_3008.server_start_id;
assert.equal(c.connector_map_status, expectedCurrentStatus);
assert.match(currentServerStartId, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
assert.equal(c.server_start_id, currentServerStartId);
assert.equal(c.combined_fingerprint, expectedCurrentFingerprint);
assert.equal(c.tool_names_hash, expectedCurrentHash);
assert.equal(c.tool_count, 98);
assert.equal(c.repo_current_expected_tool_count, 98);
assert.equal(c.connector_refresh_required_now, false);
assert.equal(c.connector_ui_visibility_verified_now, true);
assert.equal(c.model_runtime_callable_verified_now, true);
assert.equal(state.current_runtime_truth.oauth21_3008.restart_required_now, false);
assert.equal(state.current_runtime_truth.oauth21_3008.cbm_contract, "live_hardened_v0_9_0_with_upstream_201_277_caveats_and_snippet_integrity");
assert.equal(Object.hasOwn(state, "active_planned_work"), false);
assert.equal(Object.hasOwn(state, "tools_list_cache_diagnostics"), false);

assert.ok(plan.includes("Status: D1-A/D1-B/D1-C REPO APPLIED / LIVE VALIDATED ON TESTS_MCP 3008"));
assert.ok(plan.includes("f43a3eed6fb79bb6"));
assert.ok(plan.includes("8b62ecaf89227335"));
assert.ok(plan.includes("Connector-visible map comparison is `in_sync` at `43/43`"));
assert.ok(index.includes("live OAuth21 `3008` has source commit `f2a574b28bed53b32093d23d0bd06321e58c4b8c` loaded at `server_start_id = 2026-08-17T15:20:52.127Z`"));
assert.ok(index.includes("subsequent repository commits add workflow-only acceptance evidence"));
assert.ok(index.includes(`fingerprint \`${expectedCurrentFingerprint}\``));
assert.ok(index.includes("`MCP-TASKS-PROCESS-ADAPTER` (`7 + 294`)"));
assert.ok(index.includes("`TRACE-CONTEXT` (`7 + 298`)"));
assert.ok(index.includes("`PROCESS-ARTIFACTS` (`7 + 301`)"));
assert.ok(index.includes("`CIMD` (`7 + 304`)"));
assert.ok(index.includes("live-loaded and live-accepted"));
assert.ok(index.includes("`MRTR` remains fixture-only conformance evidence at `7 + 305`"));
assert.ok(index.includes("runtime loading is not applicable"));
assert.ok(index.includes("The operator refreshed OAuth authorization and the connector tool list"));
assert.ok(index.includes("survived the subsequent supervisor restart with OAuth state intact"));
assert.ok(index.includes("`next_primary = comp-1a-on-fresh-external-client-traffic`"));
assert.ok(index.includes("`next_secondary = ops-1b-on-live-sftp-boundary`"));
assert.ok(!index.includes("current live and repository surface 84 connector-visible tools"));
assert.ok(!index.includes("finish the controlled 85-tool task-lifecycle deployment"));
assert.ok(index.includes("Refreshed `COMP-1A` on August 17, 2026"));
assert.ok(index.includes("`codex-mcp-client 0.148.0-alpha.9` remains `initialize_only` with `3` successful legacy `initialize` entries and `0` `server/discover` entries"));
assert.ok(index.includes("canonical PKCE"));
assert.ok(index.includes("routes documentation/workflow questions to the dependency-free knowledge index"));
assert.ok(index.includes("knowledge index"));
assert.ok(canon.includes("Repo current connector-visible authenticated tool target is `98`"));
assert.ok(canon.includes("`PROC-1B` is accepted and remains live on the `98`-tool runtime"));
assert.ok(canon.includes("`MCP-TASKS-PROCESS-ADAPTER` is repo-validated, live-loaded, and live-accepted"));
assert.ok(canon.includes("`TRACE-CONTEXT` is repo-validated, live-loaded, and live-accepted"));
assert.ok(canon.includes("`PROCESS-ARTIFACTS` is repo-validated, live-loaded, and live-accepted"));
assert.ok(canon.includes("`CIMD` is repo-validated, live-loaded, and live-accepted"));
assert.ok(canon.includes("`MRTR` is repo-validated and closed as fixture-only conformance evidence"));
assert.ok(canon.includes("runtime loading is therefore not applicable"));
assert.ok(canon.includes("server_start_id = 2026-08-16T19:04:37.288Z"));
assert.ok(canon.includes("Only live SFTP remains open for OPS-1"));assert.ok(canon.includes("CBM reliability hardening is live"));
assert.ok(canon.includes("descriptor review is closed without manual connector refresh"));
assert.ok(descriptorReview.includes("Status: GREEN / CURRENT CODEX CLIENT FETCHED CURRENT DESCRIPTORS / NO MANUAL CONNECTOR REFRESH REQUIRED"));
assert.ok(descriptorReview.includes("codex-mcp-client 0.146.0-alpha.9.2"));
assert.ok(descriptorReview.includes("Descriptor fingerprint: `26f35b84a92470b8`"));
assert.ok(descriptorReview.includes("Combined fingerprint: `673f28e12afea85c`"));
assert.ok(descriptorReview.includes("connector_refresh_required_now = false"));

console.log("smoke_tools_list_cache_live_validation ok");
