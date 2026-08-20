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

const expectedCurrentStatus = "repo98_runtime98_model98_schema_current";
const expectedLiveFingerprint = SURFACE.combined_fingerprint;
const expectedRepoTargetFingerprint = SURFACE.combined_fingerprint;
const expectedCurrentHash = SURFACE.tool_names_hash;

const c = state.current_connector_truth.oauth21_3008_tools;
const currentServerStartId = state.current_runtime_truth.oauth21_3008.server_start_id;
assert.equal(c.connector_map_status, expectedCurrentStatus);
assert.match(currentServerStartId, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
assert.equal(c.server_start_id, currentServerStartId);
assert.equal(c.combined_fingerprint, expectedLiveFingerprint);
assert.equal(c.tool_names_hash, expectedCurrentHash);
assert.equal(c.tool_count, 98);
assert.equal(c.repo_current_expected_tool_count, 98);
assert.equal(c.connector_refresh_required_now, false);
assert.equal(c.connector_ui_visibility_verified_now, true);
assert.equal(c.model_runtime_callable_verified_now, true);
assert.equal(state.current_runtime_truth.oauth21_3008.restart_required_now, true);
assert.equal(state.current_runtime_truth.oauth21_3008.cbm_contract, "live_hardened_v0_9_0_with_upstream_201_277_caveats_and_snippet_integrity");
assert.equal(Object.hasOwn(state, "active_planned_work"), false);
assert.equal(Object.hasOwn(state, "tools_list_cache_diagnostics"), false);

assert.ok(plan.includes("Status: D1-A/D1-B/D1-C REPO APPLIED / LIVE VALIDATED ON TESTS_MCP 3008"));
assert.ok(plan.includes("f43a3eed6fb79bb6"));
assert.ok(plan.includes("8b62ecaf89227335"));
assert.ok(plan.includes("Connector-visible map comparison is `in_sync` at `43/43`"));
assert.ok(index.includes("Current repo/runtime note: profile `tests`; live OAuth21 `3008` is the temporary recovery runtime"));
assert.ok(index.includes("Runtime and authenticated connector still expose `98` tools with unchanged combined fingerprint"));
assert.ok(index.includes(`fingerprint \`${expectedLiveFingerprint}\``));
assert.ok(index.includes(`combined fingerprint \`${expectedRepoTargetFingerprint}\``));
assert.ok(index.includes("`restart_required_now = true`"));
assert.ok(index.includes("connector refresh is not required because the governed surface is unchanged"));
assert.ok(index.includes("Live-loaded the P0-P3 protocol foundation on August 16, 2026"));
assert.ok(index.includes("Live acceptance proved Tasks negotiation/completion, W3C request-to-execution ancestry, immutable Task artifacts plus authenticated `resources/read`, and CIMD special-use-IP SSRF rejection."));
assert.ok(index.includes("Completed production `MRTR` on August 18, 2026"));
assert.ok(index.includes("The module is loaded-dormant until policy emits `mrtr_requirement`."));
assert.ok(index.includes("The operator refreshed OAuth authorization and the connector tool list"));
assert.ok(index.includes("survived the subsequent supervisor restart with OAuth state intact"));
assert.ok(index.includes("1. Complete the capability-adaptive `POL-1A-CONSENT` authorization reconciliation live acceptance"));
assert.ok(index.includes("then execute `POL-1A-PROMPT`"));
assert.ok(index.includes("Historical `POL-1A-CONSENT` process-MRTR acceptance"));
assert.ok(index.includes("bounded process tools no longer require fresh consent by default"));
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
assert.ok(canon.includes("`MRTR` is production-loaded and live accepted at `7 + 310`"));
assert.ok(canon.includes(`the runtime still exposes \`98\` tools with fingerprint \`${expectedLiveFingerprint}\` and needs no connector refresh.`));
assert.ok(canon.includes("server_start_id = 2026-08-16T19:04:37.288Z"));
assert.ok(canon.includes("Preserve production MRTR, `OPS-1`, live Tasks/Trace/Artifacts/CIMD"));
assert.ok(canon.includes("CBM reliability hardening is live"));
assert.ok(canon.includes("descriptor review is closed without manual connector refresh"));
assert.ok(descriptorReview.includes("Status: GREEN / CURRENT CODEX CLIENT FETCHED CURRENT DESCRIPTORS / NO MANUAL CONNECTOR REFRESH REQUIRED"));
assert.ok(descriptorReview.includes("codex-mcp-client 0.146.0-alpha.9.2"));
assert.ok(descriptorReview.includes("Descriptor fingerprint: `26f35b84a92470b8`"));
assert.ok(descriptorReview.includes("Combined fingerprint: `673f28e12afea85c`"));
assert.ok(descriptorReview.includes("connector_refresh_required_now = false"));

console.log("smoke_tools_list_cache_live_validation ok");
