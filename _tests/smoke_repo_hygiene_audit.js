"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
function listJsFilesRecursive(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listJsFilesRecursive(fullPath));
      continue;
    }
    if (entry.name.endsWith(".js")) results.push(fullPath);
  }
  return results;
}

const audit = read("_workflow", "operator_decisions", "post_stage13_repo_hygiene_audit.md");
const canon = read("_workflow", "WORKFLOW_CANON.md");
const index = read("_workflow", "ACTIVE_WORKFLOW_INDEX.md");
const state = JSON.parse(read("_workflow", "state.json"));
const smokeScripts = JSON.parse(read("_tests", "run_all_smoke_scripts.json"));
const testsReadme = read("_tests", "README.md");
const hermeticServerControlEnv = read("_tests", "helpers", "hermetic_server_control_env.js");
const nonRunAllAudit = read("_tests", "NON_RUN_ALL_AUDIT.md");
const workflowHelperManifest = JSON.parse(read("_tests", "run_all_workflow_control_plane_smoke_scripts.json"));
const readinessHelperManifest = JSON.parse(read("_tests", "run_all_readiness_smoke_scripts.json"));
const targetedDebtHelperManifest = JSON.parse(read("_tests", "run_all_targeted_debt_smoke_scripts.json"));

for (const required of [
  "Status: GREEN / AUDIT ONLY",
  "No unchecked Markdown task boxes were found under _workflow.",
  "Runtime Enforcement Apply Package - no-apply proposal first.",
  "Cooperative Tool Cancellation.",
  "Event-driven Hotplug Lifecycle.",
  "Sessionless / Explicit State Handles Target Selection.",
  "Legacy Retired Auth Test Archive/Cleanup.",
  "CRLF Batch Normalization.",
  "no implementation approval",
]) assert.ok(audit.includes(required), required);

assert.ok(canon.includes("Repo hygiene audit green"));
assert.ok(index.includes("post_stage13_repo_hygiene_audit.md"));
assert.ok(index.includes("Active remaining work queue"));

assert.equal(state.schema_version, "workflow-state-spec-map-v2");
assert.equal(state.status, "compact_orientation_map_not_progress_log");
assert.ok(!Object.hasOwn(state, "post_stage13_hygiene"));

const topLevelTests = fs.readdirSync(path.join(ROOT, "_tests")).filter((name) => name.endsWith(".js")).map((name) => path.normalize(`_tests/${name}`));
const totalJsFiles = listJsFilesRecursive(path.join(ROOT, "_tests"));
const activeManifest = new Set(smokeScripts.map((name) => path.normalize(name)));
const nonRunAll = topLevelTests.filter((name) => !activeManifest.has(name));
const undocumentedNonRunAll = nonRunAll.filter((name) => !nonRunAllAudit.includes(`\`${path.basename(name)}\``));
const serverSpawningTests = topLevelTests.filter((name) => {
  const source = fs.readFileSync(path.join(ROOT, name), "utf8");
  return /spawn(?:Sync)?\([^\n]*process\.execPath[^\n]*server\.js|\[\"server\.js\"/.test(source);
});
const unisolatedServerSpawningTests = serverSpawningTests.filter((name) => {
  const source = fs.readFileSync(path.join(ROOT, name), "utf8");
  return !source.includes("withHermeticServerControlEnv") && !source.includes("MCP_TEST_TOOL_SURFACE_STATE_FILE");
});

assert.equal(totalJsFiles.length, 381);
assert.equal(smokeScripts.length, 297);
assert.equal(nonRunAll.length, 43);
assert.equal(workflowHelperManifest.length, 25);
assert.equal(readinessHelperManifest.length, 45);
assert.equal(targetedDebtHelperManifest.length, 6);
assert.deepEqual(undocumentedNonRunAll, []);
assert.deepEqual(unisolatedServerSpawningTests, []);
assert.ok(hermeticServerControlEnv.includes("MCP_TEST_AUDIT_LOG"), "shared hermetic child-server env must isolate the audit log");

assert.ok(testsReadme.includes("`381` JavaScript files total in `_tests`"));
assert.ok(testsReadme.includes("`297` active scripts currently listed in `run_all_smoke_scripts.json`"));
assert.ok(testsReadme.includes("`43` top-level `_tests/*.js` files currently outside default `run_all`"));
assert.ok(testsReadme.includes("Current workflow/control-plane helper manifest size: `25` scripts"));
assert.ok(testsReadme.includes("Current readiness helper manifest size: `45` scripts"));
assert.ok(testsReadme.includes("Current targeted/debt helper manifest size: `6` scripts"));
assert.ok(nonRunAllAudit.includes("current mechanical non-`run_all` count is `43`"));
assert.ok(nonRunAllAudit.includes("live_cloudflare_boundary_probe.js"));
assert.ok(nonRunAllAudit.includes("stress_cbm_bridge_samples.js"));
assert.ok(nonRunAllAudit.includes("run_all_targeted_debt_smoke_scripts.json"));

console.log("smoke_repo_hygiene_audit ok");
