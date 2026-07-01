"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
function readText(...parts) { return fs.readFileSync(path.join(ROOT, ...parts), "utf8"); }

const gitattributes = readText(".gitattributes");
const editorconfig = readText(".editorconfig");
const plan = readText("_workflow", "operator_decisions", "stage13_crlf_hygiene_plan.md");
const normalizedRecord = readText("_workflow", "operator_decisions", "crlf_batch_normalization_lf_policy.md");
const canon = readText("_workflow", "WORKFLOW_CANON.md");
const index = readText("_workflow", "ACTIVE_WORKFLOW_INDEX.md");
const smokeScripts = JSON.parse(readText("_tests", "run_all_smoke_scripts.json"));

for (const required of [
  "* text=auto eol=lf",
  ".gitattributes text eol=lf",
  "*.js text eol=lf",
  "*.json text eol=lf",
  "*.md text eol=lf",
  "*.ps1 text eol=lf",
]) assert.ok(gitattributes.includes(required), required);
assert.equal(gitattributes.includes("eol=crlf"), false);
assert.ok(editorconfig.includes("end_of_line = lf"));

for (const required of [
  "GREEN / PLAN AND GUARD ONLY",
  "Do not run global normalization in Stage 13.3",
  "Current working-tree CRLF population: 191 tracked text files",
  "Preserve *.ps1 CRLF unless a PowerShell-specific decision changes that policy",
  "Superseded by CRLF Batch Normalization and LF Policy",
]) assert.ok(plan.includes(required), required);

assert.ok(canon.includes("Stage 13.3 CRLF hygiene plan green"));
assert.ok(canon.includes("191 tracked text files still contain CRLF"));
assert.ok(canon.includes("CRLF Batch Normalization and LF Policy green"));
assert.ok(index.includes("stage13_crlf_hygiene_plan.md"));
assert.ok(index.includes("crlf_batch_normalization_lf_policy.md"));
assert.ok(normalizedRecord.includes("after_crlf_tracked_text_files: 0"));

assert.ok(smokeScripts.includes("_tests/smoke_crlf_hygiene_plan.js"));
assert.ok(smokeScripts.includes("_tests/smoke_crlf_batch_normalization_lf_policy.js"));

console.log("smoke_crlf_hygiene_plan ok");
