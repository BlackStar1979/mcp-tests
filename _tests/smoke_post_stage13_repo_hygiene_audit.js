"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

const audit = read("_workflow", "operator_decisions", "post_stage13_repo_hygiene_audit.md");
const canon = read("_workflow", "WORKFLOW_CANON.md");
const index = read("_workflow", "ACTIVE_WORKFLOW_INDEX.md");
const state = JSON.parse(read("_workflow", "state.json"));
const smokeScripts = JSON.parse(read("_tests", "run_all_smoke_scripts.json"));

for (const required of [
  "Status: GREEN / AUDIT ONLY",
  "No unchecked Markdown task boxes were found under _workflow.",
  "Runtime Enforcement Apply Package - no-apply proposal first.",
  "Cooperative Tool Cancellation C3.",
  "Event-driven Hotplug Lifecycle.",
  "Sessionless / Explicit State Handles Target Selection.",
  "Legacy Retired Auth Test Archive/Cleanup.",
  "CRLF Batch Normalization.",
  "no Stage 14 implementation approval",
]) assert.ok(audit.includes(required), required);

assert.ok(canon.includes("Post-Stage 13 repo hygiene audit green"));
assert.ok(index.includes("post_stage13_repo_hygiene_audit.md"));
assert.ok(index.includes("Active remaining work queue"));

assert.equal(state.schema_version, "workflow-state-spec-map-v2");
assert.equal(state.status, "compact_orientation_map_not_progress_log");
assert.ok(!Object.hasOwn(state, "post_stage13_hygiene"));

console.log("smoke_post_stage13_repo_hygiene_audit ok");
