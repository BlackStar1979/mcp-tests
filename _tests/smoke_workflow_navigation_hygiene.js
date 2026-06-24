"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

const index = read("_workflow", "ACTIVE_WORKFLOW_INDEX.md");
const canon = read("_workflow", "WORKFLOW_CANON.md");
const state = JSON.parse(read("_workflow", "state.json"));
const smokeScripts = JSON.parse(read("_tests", "run_all_smoke_scripts.json"));

assert.ok(index.includes("Status: active navigation index"));
assert.ok(index.includes("Do not create a separate master document."));
assert.ok(index.includes("Do not infer active work from historical plan files"));
assert.ok(index.includes("## Active remaining work queue"));
assert.ok(index.includes("Closed historical stages and historical plans below are retained for traceability, not active next-work lists."));

assert.ok(canon.includes("Latest validated public section count: `6`"));
assert.ok(canon.includes("Latest validated authenticated smoke count: `158`"));
assert.ok(canon.includes("## 3A. Current active work queue"));
assert.ok(canon.includes("Workflow file count is not a project-progress metric."));
assert.ok(canon.includes("No Stage 14 implementation approval is recorded."));

for (const stale of [
  "Latest validated public section count: `8`",
  "Latest validated authenticated smoke count after HTTP boundary guard: `116`",
  "Workflow memory compaction: `_workflow` reduced from 425 files to 45 files",
  "## 3A. Active Streamable HTTP / Sampling / OAuth workflow",
  "Active roadmap: `_workflow/STREAMABLE_HTTP_SAMPLING_OAUTH_WORKFLOW.md`",
  "Current workflow preparation status: `ready_streamable_http_workflow_plan`",
]) {
  assert.equal(canon.includes(stale), false, stale);
}

assert.equal(state.post_stage13_hygiene.workflow_navigation_hygiene.status, "green");
assert.equal(state.post_stage13_hygiene.workflow_navigation_hygiene.new_master_document_created, false);
assert.ok(smokeScripts.includes("_tests/smoke_workflow_navigation_hygiene.js"));

console.log("smoke_workflow_navigation_hygiene ok");
