"use strict";
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function readJson(rel) { return JSON.parse(read(rel)); }
const gitattributes = read(".gitattributes");
const editorconfig = read(".editorconfig");
assert.ok(gitattributes.includes("* text=auto eol=lf"));
assert.ok(gitattributes.includes("*.ps1 text eol=lf"));
assert.equal(gitattributes.includes("eol=crlf"), false);
assert.ok(editorconfig.includes("root = true"));
assert.ok(editorconfig.includes("end_of_line = lf"));
assert.equal(editorconfig.includes("end_of_line = crlf"), false);
const files = cp.execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
const crlfFiles = [];
for (const rel of files) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) continue;
  const data = fs.readFileSync(full);
  if (data.includes(0)) continue;
  if (data.includes(Buffer.from("\r\n"))) crlfFiles.push(rel);
}
assert.deepEqual(crlfFiles, []);
const record = read("_workflow/operator_decisions/crlf_batch_normalization_lf_policy.md");
assert.ok(record.includes("Status: GREEN / NORMALIZED / SYSTEM LF POLICY"));
assert.ok(record.includes("before_crlf_tracked_text_files: 321"));
assert.ok(record.includes("after_crlf_tracked_text_files: 0"));
const state = readJson("_workflow/state.json");
assert.equal(state.crlf_batch_normalization.status, "normalized_lf_policy_active");
assert.equal(state.crlf_batch_normalization.before_crlf_count, 321);
assert.equal(state.crlf_batch_normalization.after_crlf_count, 0);
console.log("smoke_crlf_batch_normalization_lf_policy ok");
