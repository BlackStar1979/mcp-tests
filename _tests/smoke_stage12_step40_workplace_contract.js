"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const canon = fs.readFileSync(path.join(root, "_workflow", "WORKFLOW_CANON.md"), "utf8");

for (const token of [
  "# TEST MCP WORKFLOW CANON",
  "## 1. Non-negotiable operating rules",
  "## 2. Truth layers",
  "## 3. Current validated state",
  "## 4. Runtime architecture",
  "## 5. Active controls",
  "## 6. Workflow/deploy vocabulary",
  "## 7. Step history compressed",
  "## 8. Mechanism endurance status",
  "## 9. Known debts",
  "## 10. Next safe development path",
  "## 12. Directory roles and retention",
  "State compaction",
  "Stage-log compaction",
  "Backup cleanup",
  "Log cleanup",
  "Scratch cleanup",
  "server_change",
  "workflow_change",
  "schema_change",
  "runtime_restart_required",
  "connector_refresh_required",
  "backup_required",
  "rollback_path",
  "restore_path",
  "Snapshot: bounded copy",
  "Deploy: applying an approved change package",
  "Rollback: reversing a recorded deployment",
  "Restore: recovering a path",
  "Server schema change: MCP-visible change",
  "Restart: reload live MCP process",
  "Connector refresh: update/review connector-visible action surface",
  "Historical `_workflow/longterm/**` and `_workflow/patch_manifests/**` are no longer active memory",
  "Do not store progress logs in `_stages`",
  "`.temp`: zero-retention scratch",
  "`_workflow/baselines/**`: golden reference data",
  "`_workflow/scripts/**`: workflow/control-plane utilities",
  "Keep only reusable utilities",
  "compact_runtime_logs.js",
  "Control-plane safety mechanism",
  "workflow safety mechanism",
  "_workflow/control_plane/**",
  "_workflow/control_plane/snapshots/**",
  "_workflow/control_plane/retired_root_backups/**",
  "_backups/**` must not be recreated",
  "_fixtures/**`: ordinary static test fixtures",
  "_backups/**`: old uncontrolled backup bucket",
  "Test fixtures boundary",
  "_tests/fixtures/**",
  "test-only plugin template",
  "Mechanism reference library",
  "source material for server improvement",
  "do not remove it as part of workflow compaction",
  "`_tests/**`: executable validation surface"
]) {
  assert.ok(canon.includes(token), `missing workflow canon token: ${token}`);
}

console.log("smoke_stage12_step40_workplace_contract ok");
