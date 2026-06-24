"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const json = (...parts) => JSON.parse(read(...parts));

const record = read("_workflow", "operator_decisions", "stage14_2b_repo_gremlin_double_scan.md");
const canon = read("_workflow", "WORKFLOW_CANON.md");
const index = read("_workflow", "ACTIVE_WORKFLOW_INDEX.md");
const state = json("_workflow", "state.json");
const manifest = json("_tests", "run_all_smoke_scripts.json");
const serverSpec = json("SERVER_SPEC.json");
const truthAudit = read("src", "truth", "project_truth_audit.js");
const stressWorkflow = read("_tests", "stress_workflow.js");
const preflightGuard = read("_tests", "smoke_stage8_52c_preflight_control_plane_guard.js");
const stage14_2Guard = read("_tests", "smoke_stage14_2_workbench_debt_cleanup.js");
const streamableGuard = read("_tests", "smoke_stage12_streamable_http_workflow_plan.js");

const codeRuntimeMap = read("src", "truth", "code_runtime_map.js");
const historicalRefs = [
  "_workflow/PREFLIGHT.md",
  "_workflow/WORKING_COURSE.md",
  "_workflow/SERVER_SPEC.md",
  "_workflow/INDEX.md",
  "_workflow/NEXT_CHAT_HANDOFF.md",
];
for (const oldRef of historicalRefs) {
  assert.equal(truthAudit.includes(oldRef), false, `project truth audit still references ${oldRef}`);
  assert.equal(codeRuntimeMap.includes(oldRef), false, `code runtime map still references ${oldRef}`);
}

for (const required of [
  "GREEN / DOUBLE SCAN / NO APPLY",
  "Pass 1 - semantic debt scan",
  "Pass 2 - structural active-surface scan",
  "Remaining `_backups` references classified as intentional",
  "no server restart",
  "no connector refresh",
]) assert.ok(record.includes(required), required);

assert.equal(fs.existsSync(path.join(ROOT, "_backups")), false);
const legacyRootBackupEntry = serverSpec.repository_layout_contract.root_policy.tolerated_legacy_root_items.find((entry) => entry.path === "server.js.bak-*");
assert.equal(legacyRootBackupEntry.target, "_workflow/control_plane/retired_root_backups/");
assert.ok(canon.includes("Root `_backups/**` is retired and must not be recreated."));
assert.ok(truthAudit.includes("_workflow/control_plane/snapshots"));
assert.equal(truthAudit.includes("_backups/snapshots/2026-05-23T21-43-57-943Z_stage8_53-pre-server-split.json"), false);
assert.ok(stressWorkflow.includes("_workflow", "control_plane"));
assert.ok(stressWorkflow.includes("control_plane"));
assert.ok(stressWorkflow.includes("workflow_stress"));
assert.equal(stressWorkflow.includes('"_backups", "workflow_stress"'), false);
assert.ok(preflightGuard.includes("_workflow/control_plane/deploy_records"));
assert.ok(preflightGuard.includes("_workflow/control_plane/file_backups"));
assert.ok(preflightGuard.includes("_workflow/control_plane/snapshots"));
assert.equal(preflightGuard.includes("_backups/deploy"), false);
const currentPackageIdPin = "state.current_work_package." + "id";
const currentPackageStatusPin = "state.current_work_package." + "status";
assert.equal(stage14_2Guard.includes(currentPackageIdPin), false);
assert.equal(stage14_2Guard.includes(currentPackageStatusPin), false);
assert.equal(streamableGuard.includes("pending_commit"), false);
assert.equal(streamableGuard.includes("green_stage14_2_workbench_debt_cleanup"), false);
assert.ok(streamableGuard.includes('typeof state.current_work_package.id === "string"'));

assert.equal(state.stage14.stage14_2b.status, "green");
assert.equal(state.stage14.stage14_2b.runtime_restart_required, false);
assert.equal(state.stage14.stage14_2b.connector_refresh_required, false);
assert.equal(state.stage14.stage14_2b.no_root_backups_recreated, true);
assert.ok(manifest.includes("_tests/smoke_stage14_2b_repo_gremlin_double_scan.js"));
assert.ok(index.includes("stage14_2b_repo_gremlin_double_scan.md"));

console.log("smoke_stage14_2b_repo_gremlin_double_scan ok");
