"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const workflowPath = path.join(root, "_workflow", "STREAMABLE_HTTP_SAMPLING_OAUTH_WORKFLOW.md");
const workflow = fs.readFileSync(workflowPath, "utf8");
const canon = fs.readFileSync(path.join(root, "_workflow", "WORKFLOW_CANON.md"), "utf8");
const index = fs.readFileSync(path.join(root, "_workflow", "ACTIVE_WORKFLOW_INDEX.md"), "utf8");
const state = JSON.parse(fs.readFileSync(path.join(root, "_workflow", "state.json"), "utf8"));

for (const phase of [
  "Phase A - Streamable HTTP preflight",
  "Phase B - POST SSE response path",
  "Phase C - SessionStore and lifecycle",
  "Phase D - GET SSE stream and outbound queue",
  "Phase E - Pending request correlation",
  "Phase F - Sampling readiness",
  "Phase G - OAuth preflight and implementation",
]) {
  assert.ok(workflow.includes(phase), `${phase} missing`);
}

for (const required of [
  "Do not enable OAuth until Phase A-F are green",
  "MCP-Protocol-Version",
  "text/event-stream",
  "Mcp-Session-Id",
  "outbound queue",
  "pending request correlation",
  "sampling/createMessage",
  "capabilities.sampling",
  "node _tests/run_all_smokes.js --skip-network = ok",
]) {
  assert.ok(workflow.includes(required), `${required} missing`);
}

assert.ok(index.includes("STREAMABLE_HTTP_SAMPLING_OAUTH_WORKFLOW.md"));
assert.equal(state.schema_version, "workflow-state-spec-map-v2");
assert.equal(state.status, "compact_orientation_map_not_progress_log");
assert.ok(Object.hasOwn(state.root_spec_map, "SERVER_SPEC.json"));

console.log("smoke_streamable_http_workflow_plan ok");
