"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const state = JSON.parse(fs.readFileSync(path.join(root, "_workflow", "state.json"), "utf8"));
const canon = fs.readFileSync(path.join(root, "_workflow", "WORKFLOW_CANON.md"), "utf8");

assert.equal(state.schema_version, "workflow-state-compact-v1");
assert.equal(state.project, "mcp-tests");
assert.equal(state.source_of_operational_truth, "_workflow/WORKFLOW_CANON.md");
assert.ok(state.current_work_package && state.current_work_package.id);
assert.ok(state.last_validated_runtime && state.last_validated_runtime.full_smoke_skip_network === "ok_0_30_0_8_141");
assert.ok(Array.isArray(state.active_controls));
assert.ok(canon.includes("# TEST MCP WORKFLOW CANON"));
assert.ok(canon.includes("Directory roles and retention"));
assert.ok(canon.includes("State compaction"));
assert.ok(canon.includes("Stage-log compaction"));

console.log("smoke_workflow_state ok");
