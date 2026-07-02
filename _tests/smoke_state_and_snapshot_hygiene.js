"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/state_and_snapshot_hygiene.md");
const stateText = read("_workflow/state.json");
const state = JSON.parse(stateText);
const inventory = readJson("_workflow/sessionless_inventory.json");
const pluginSpec = readJson("SERVER_PLUGIN_VISIBILITY_POLICY_SPEC.json");
const legacyManifest = readJson("_tests/legacy_retired_auth_smoke_manifest.json");
const connectorSpec = readJson("SERVER_CONNECTOR_SURFACE_SPEC.json");
const backupScript = read("_workflow/scripts/test_mcp_backup.ps1");
const snapshotScript = read("_workflow/scripts/workflow_snapshot.js");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const workflowReadme = read("_workflow/README.md");
const snapshotReadme = read("_workflow/control_plane/snapshots/README.md");
const retiredRootBackupsReadme = read("_workflow/control_plane/retired_root_backups/README.md");
const workflowHistoricalReadme = read("_workflow/historical/README.md");
const testsArchiveReadme = read("_tests/archive/README.md");
const legacyAuthArchiveReadme = read("_tests/archive/legacy_retired_auth/README.md");
const nonRunAllArchiveReadme = read("_tests/archive/non_run_all_stale/README.md");
const manifest = readJson("_tests/run_all_smoke_scripts.json");

assert.ok(record.includes("Status: GREEN / REPAIRED / NO RUNTIME CHANGE"));
assert.ok(record.includes("reduce `_workflow/state.json` back to a compact orientation map"));
assert.ok(record.includes("stop and clean recursive snapshot embedding"));
assert.ok(record.includes("Existing nested snapshot subtrees under top-level snapshot directories were removed."));

assert.ok(stateText.length < 15000);
for (const removed of [
  "next_step_recommendation_policy",
  "hotplug_lifecycle",
  "sessionless_target_selection",
  "legacy_retired_auth_cleanup",
  "root_spec_sessionless_ready_review",
  "crlf_batch_normalization",
]) {
  assert.equal(Object.hasOwn(state, removed), false, `state.json must not retain ${removed}`);
}

assert.equal(state.current_runtime_truth.oauth21_3008.expected_tool_count, 43);
assert.equal(state.current_runtime_truth.oauth21_3008.restart_required_now, false);
assert.equal(state.current_connector_truth.oauth21_3008_tools.tool_count, 43);
assert.equal(state.current_connector_truth.oauth21_3008_tools.tool_names_hash, "8b62ecaf89227335");
assert.equal(state.current_connector_truth.oauth21_3008_tools.connector_map_status, "in_sync_43_of_43");

assert.ok(inventory.target_selection_readiness.s15_connector_reconnect_execution_evidence);
assert.equal(pluginSpec.hotplug_lifecycle_readiness.status, "hpl1_to_hpl4_reconciled_hpl5_gated");
assert.equal(legacyManifest.status, "legacy_retired_auth_archive_cleanup_completed");
assert.equal(connectorSpec.oauth21_connector.path, "/mcp");

assert.ok(backupScript.includes("$SnapshotRoot"));
assert.ok(backupScript.includes("Copy-ItemWithoutNestedSnapshots"));
assert.ok(snapshotScript.includes("_workflow/control_plane/snapshots"));
assert.ok(snapshotScript.includes("nested control-plane snapshots"));
assert.ok(workflowReadme.includes("`_workflow/control_plane/snapshots/` is an immutable archival bucket"));
assert.ok(snapshotReadme.includes("This directory is a historical archive of point-in-time workflow/runtime copies"));
assert.ok(snapshotReadme.includes("Snapshot contents are not the active source of truth."));
assert.ok(retiredRootBackupsReadme.includes("This directory is an archival quarantine for legacy root-level backup material"));
assert.ok(retiredRootBackupsReadme.includes("A grep hit in this directory is archival evidence first, not current implementation guidance."));
assert.ok(workflowHistoricalReadme.includes("This directory is the workflow-history archive boundary."));
assert.ok(workflowHistoricalReadme.includes("Contents here are historical records, not active machine authority."));
assert.ok(testsArchiveReadme.includes("This directory is an archive boundary inside `_tests`."));
assert.ok(testsArchiveReadme.includes("Files here are not part of the active top-level `_tests` validation surface."));
assert.ok(legacyAuthArchiveReadme.includes("These files are archived only and are not active coverage."));
assert.ok(legacyAuthArchiveReadme.includes("_tests/smoke_legacy_retired_auth_negative_controls.js"));
assert.ok(nonRunAllArchiveReadme.includes("Do not treat these files as current validation coverage."));

const snapshotRoot = path.join(ROOT, "_workflow", "control_plane", "snapshots");
const nested = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const p = path.join(dir, entry.name);
    const rel = path.relative(ROOT, p).replace(/\\/g, "/");
    if (/_workflow\/control_plane\/snapshots\/.+\/_workflow\/control_plane\/snapshots(\/|$)/.test(rel)) nested.push(rel);
    walk(p);
  }
}
walk(snapshotRoot);
assert.deepEqual(nested, []);

assert.ok(canon.includes("Latest known full smoke: `node ./_tests/run_all_smokes.js --skip-network = ok_0_40_0_7_209`"));
assert.ok(canon.includes("Latest validated authenticated smoke count: `209`"));
assert.ok(canon.includes("S16 state and snapshot hygiene repair green"));
assert.ok(index.includes("Latest full smoke after state-and-snapshot hygiene guard: `ok_0_40_0_7_209`."));
assert.ok(index.includes("Authenticated smoke count: `209`."));
assert.ok(index.includes("state_and_snapshot_hygiene.md"));
assert.ok(manifest.includes("_tests/smoke_state_and_snapshot_hygiene.js"));

console.log("smoke_state_and_snapshot_hygiene ok");

