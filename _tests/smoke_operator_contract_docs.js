"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const exists = (...parts) => fs.existsSync(path.join(ROOT, ...parts));

for (const rel of [
  ["DIRECTORY.md"],
  ["_workflow", "DIRECTORY.md"],
  ["scripts", "DIRECTORY.md"],
  ["profiles", "DIRECTORY.md"],
  ["src", "DIRECTORY.md"],
  ["tools", "DIRECTORY.md"],
  ["_tests", "DIRECTORY.md"],
  ["_control", "DIRECTORY.md"],
  ["_logs", "DIRECTORY.md"],
  ["_workflow", "NORTHSTAR.md"],
  ["_workflow", "STATE.md"],
  ["_workflow", "READINESS.md"],
  ["_workflow", "ROADMAP.md"],
]) {
  assert.equal(exists(...rel), true, `missing required documentation file: ${rel.join("/")}`);
}

const workflowReadme = read("_workflow", "README.md");
const workflowIndex = read("_workflow", "ACTIVE_WORKFLOW_INDEX.md");
const rootReadme = read("README.md");
const northstar = read("_workflow", "NORTHSTAR.md");
const stateDoc = read("_workflow", "STATE.md");
const readiness = read("_workflow", "READINESS.md");
const roadmap = read("_workflow", "ROADMAP.md");
const workflowState = JSON.parse(read("_workflow", "state.json"));
const rootDirectory = read("DIRECTORY.md");
const packageJson = read("package.json");

assert.ok(northstar.includes("Single-route on `/mcp`"));
assert.ok(northstar.includes("Streamable HTTP only"));
assert.ok(stateDoc.includes("Server version: `0.40.0`"));
assert.ok(stateDoc.includes("target connector-visible tools `69`"));
assert.ok(stateDoc.includes("tests_authenticated=253"));
assert.ok(stateDoc.includes("Latest validated authenticated smoke count: `253`"));
assert.ok(stateDoc.includes("`mcp__workbench` is callable again"));
assert.ok(readiness.includes("## Component maturity"));
assert.ok(readiness.includes("Operator-facing documentation contract"));
assert.ok(readiness.includes("callable again from the Codex model runtime layer"));
assert.ok(roadmap.includes("## Priority matrix"));
assert.ok(roadmap.includes("Expand `DIRECTORY` coverage"));
assert.ok(roadmap.includes("current smoke baseline and connector/runtime truth"));
assert.ok(roadmap.includes("Use current-window evidence plus blocker-matrix freshness windows together"));
assert.equal(workflowState.workflow_progress_markers.next_primary, "post_53d-real-client-entry-evidence-refresh");
assert.equal(workflowState.workflow_progress_markers.next_secondary, "post_53d-decision-relevant-connector-visible-surface-revalidation");

assert.ok(rootDirectory.includes("This top-level map is intentional but not yet exhaustive"));
assert.ok(rootDirectory.includes("npm run docs:directory"));
assert.ok(workflowReadme.includes("`_workflow/NORTHSTAR.md`"));
assert.ok(workflowReadme.includes("`_workflow/ROADMAP.md`"));
assert.ok(workflowIndex.includes("Operator-facing documentation contract"));
assert.ok(workflowIndex.includes("`_workflow/NORTHSTAR.md`"));
assert.ok(workflowIndex.includes("`next_primary = post_53d-real-client-entry-evidence-refresh`"));
assert.ok(workflowIndex.includes("`next_secondary = post_53d-decision-relevant-connector-visible-surface-revalidation`"));
assert.ok(rootReadme.includes("## Operator-Facing Documentation"));
assert.ok(packageJson.includes("\"docs:directory\": \"node scripts/generate_directory_docs.js\""));

console.log("smoke_operator_contract_docs ok");
