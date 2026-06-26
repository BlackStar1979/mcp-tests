"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const json = (...parts) => JSON.parse(read(...parts));

const record = read("_workflow", "operator_decisions", "stage14_2_workbench_debt_cleanup.md");
const postStage6 = read("_workflow", "operator_decisions", "post_stage6_operator_decisions_2026-06-21.md");
const gitignore = read(".gitignore");
const backupScript = read("_workflow", "scripts", "test_mcp_backup.ps1");
const integrationValidator = read("_workflow", "historical", "progress_state_dependent_validators", "_workflow", "scripts", "validate_decision_runtime_integration_plan.js");
const readinessValidator = read("_workflow", "historical", "progress_state_dependent_validators", "_workflow", "scripts", "validate_decision_runtime_interface_contract_readiness_gate.js");
const baselineReadme = read("_workflow", "baselines", "README.md");
const baseline = json("_workflow", "baselines", "stage8_frozen_runtime_baseline.json");
const state = json("_workflow", "state.json");
const smokeScripts = json("_tests", "run_all_smoke_scripts.json");

for (const required of [
  "GREEN / WORKBENCH DEBT CLEANUP / NO APPLY",
  "Every recommendation must reassess whether each existing blocker still makes sense.",
  "If a test-server restart or connector refresh becomes necessary",
  "Snapshot, deploy, rollback, and backup mechanisms belong under `_workflow/control_plane`",
  "post_stage6_operator_decisions_2026-06-21.md` is binding context",
  "baselines` must be considered before connector/tool-surface or baseline-sensitive changes",
  "test_mcp_backup.ps1",
  "_workflow/control_plane/snapshots",
  "no runtime enforcement apply",
  "legacy `_workflow/scripts` entries that still reference removed `_workflow/longterm` or `_workflow/policies`",
]) assert.ok(record.includes(required), required);

assert.ok(postStage6.includes("Decision: A. Keep public connector disconnected"));
assert.ok(postStage6.includes("runtime decision shim should eventually expand to full Resource/Scope Matrix Enforcement"));
assert.ok(postStage6.includes("Adopt a future Option D: event-driven Hotplug lifecycle"));
assert.ok(gitignore.includes("_backups/"));
assert.equal(fs.existsSync(path.join(ROOT, "_backups")), false);
assert.ok(backupScript.includes("_workflow"));
assert.ok(backupScript.includes("control_plane"));
assert.ok(backupScript.includes("snapshots"));
assert.equal(backupScript.includes('Join-Path $Repo "_backups"'), false);
assert.ok(integrationValidator.includes("_workflow/control_plane/snapshots/"));
assert.ok(readinessValidator.includes("_workflow/control_plane/snapshots/"));
assert.equal(integrationValidator.includes("_backups/workflow_snapshots"), false);
assert.equal(readinessValidator.includes("_backups/workflow_snapshots"), false);
assert.ok(baselineReadme.includes("current source of truth is the manifest content"));
assert.equal(baseline.connectorShapeVersion, "2025-05-strict-v1");
assert.ok(Array.isArray(baseline.notes));

assert.equal(state.schema_version, "workflow-state-spec-map-v2");
assert.ok(!Object.hasOwn(state, "stage14"));
assert.ok(smokeScripts.includes("_tests/smoke_stage14_2_workbench_debt_cleanup.js"));

console.log("smoke_stage14_2_workbench_debt_cleanup ok");
