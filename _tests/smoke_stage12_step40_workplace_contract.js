"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const canon = fs.readFileSync(path.join(root, "_workflow", "WORKFLOW_CANON.md"), "utf8");
const index = fs.readFileSync(path.join(root, "_workflow", "ACTIVE_WORKFLOW_INDEX.md"), "utf8");

for (const token of [
  "# TEST MCP WORKFLOW CANON",
  "## 1. Non-negotiable operating rules",
  "## 2. Truth layers",
  "## 3. Current validated state",
  "## 3A. Current active work queue",
  "## 4. Runtime architecture",
  "## 5. Active controls",
  "## 6. Workflow/deploy vocabulary",
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
  "Workflow file count is not a project-progress metric",
  "No Stage 14 implementation approval is recorded",
]) {
  assert.ok(canon.includes(token), `missing workflow canon token: ${token}`);
}

for (const token of [
  "Status: active navigation index",
  "Do not create a separate master document.",
  "Do not infer active work from historical plan files",
  "## Active remaining work queue",
  "Closed historical stages and historical plans below are retained for traceability, not active next-work lists.",
]) {
  assert.ok(index.includes(token), `missing workflow index token: ${token}`);
}

for (const stale of [
  "Latest validated public section count: `8`",
  "Latest validated authenticated smoke count after HTTP boundary guard: `116`",
  "State compaction",
  "Workflow memory compaction: `_workflow` reduced from 425 files to 45 files",
  "## 3A. Active Streamable HTTP / Sampling / OAuth workflow",
]) {
  assert.equal(canon.includes(stale), false, `stale workflow canon token remains: ${stale}`);
}

console.log("smoke_stage12_step40_workplace_contract ok");
