"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

const note = read("_workflow", "operator_decisions", "stage13_process_runner_ergonomics_note.md");
const canon = read("_workflow", "WORKFLOW_CANON.md");
const index = read("_workflow", "ACTIVE_WORKFLOW_INDEX.md");
const state = JSON.parse(read("_workflow", "state.json"));
const smokeScripts = JSON.parse(read("_tests", "run_all_smoke_scripts.json"));

for (const required of [
  "GREEN / NOTE AND GUARD ONLY",
  "Allowed commands: git, node, npm, powershell, pwsh, py, pytest, python",
  "Raw PowerShell is disabled",
  "single argument too long",
  "retry once with a smaller equivalent command",
  "stop that route and use a lower-risk equivalent probe",
  "no process-runner policy change",
]) assert.ok(note.includes(required), required);

assert.ok(canon.includes("Stage 13.4 process-runner ergonomics note green"));
assert.ok(canon.includes("Process-runner policy, command allowlists, runtime code, connector configuration, and deployment state unchanged"));
assert.ok(index.includes("stage13_process_runner_ergonomics_note.md"));
assert.ok(index.includes("Process-runner ergonomics guard"));

assert.equal(state.schema_version, "workflow-state-spec-map-v2");
assert.ok(!Object.hasOwn(state, "stage13"));
assert.ok(smokeScripts.includes("_tests/smoke_process_runner_ergonomics_note.js"));

console.log("smoke_process_runner_ergonomics_note ok");
