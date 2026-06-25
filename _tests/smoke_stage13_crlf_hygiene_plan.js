"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
function readText(...parts) { return fs.readFileSync(path.join(ROOT, ...parts), "utf8"); }

const gitattributes = readText(".gitattributes");
const plan = readText("_workflow", "operator_decisions", "stage13_crlf_hygiene_plan.md");
const canon = readText("_workflow", "WORKFLOW_CANON.md");
const index = readText("_workflow", "ACTIVE_WORKFLOW_INDEX.md");
const state = JSON.parse(readText("_workflow", "state.json"));
const smokeScripts = JSON.parse(readText("_tests", "run_all_smoke_scripts.json"));

for (const required of [
  ".gitattributes text eol=lf",
  "*.js text eol=lf",
  "*.json text eol=lf",
  "*.md text eol=lf",
  "*.ps1 text eol=crlf",
]) assert.ok(gitattributes.includes(required), required);

for (const required of [
  "GREEN / PLAN AND GUARD ONLY",
  "Do not run global normalization in Stage 13.3",
  "do not run git add --renormalize .",
  "Current working-tree CRLF population: 191 tracked text files",
  "Preserve *.ps1 CRLF",
  "no mass line-ending normalization",
]) assert.ok(plan.includes(required), required);

assert.ok(canon.includes("Stage 13.3 CRLF hygiene plan green"));
assert.ok(canon.includes("191 tracked text files still contain CRLF"));
assert.ok(canon.includes("No global normalization or git add --renormalize . was performed"));
assert.ok(index.includes("stage13_crlf_hygiene_plan.md"));
assert.ok(index.includes("Stage 13.3 CRLF hygiene guard"));

assert.equal(state.schema_version, "workflow-state-spec-map-v2");
assert.ok(!Object.hasOwn(state, "stage13"));
assert.ok(smokeScripts.includes("_tests/smoke_stage13_crlf_hygiene_plan.js"));

console.log("smoke_stage13_crlf_hygiene_plan ok");
