"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { parseArgs } = require("../scripts/audit_directory_docs");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "audit_directory_docs.js");

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

assert.deepEqual(parseArgs(["--json", "--since=30 days ago", "--limit", "25", "--min-churn=5"]), {
  since: "30 days ago",
  limit: 25,
  minChurn: 5,
  json: true,
  failOnMissing: false,
});
assert.throws(() => parseArgs(["--since"]), { code: "cli_argument_value_missing" });
assert.throws(() => parseArgs(["--limit", "0"]), { code: "cli_argument_value_invalid" });
assert.throws(() => parseArgs(["--json", "--json"]), { code: "cli_argument_duplicate" });

const jsonResult = run(["--json", "--since=30 days ago", "--limit=25", "--min-churn=5", "--fail-on-missing"]);
assert.equal(jsonResult.status, 0, `directory docs audit must pass\nSTDOUT:\n${jsonResult.stdout}\nSTDERR:\n${jsonResult.stderr}`);

const report = JSON.parse(jsonResult.stdout);
assert.equal(report.ok, true);
assert.equal(report.since, "30 days ago");
assert.equal(report.limit, 25);
assert.equal(report.min_churn, 5);
assert.equal(report.missing_count, 0);
assert.ok(report.rows.length > 0);
assert.ok(report.rows.some((row) => row.dir === "_workflow/operator_decisions" && row.has_directory === true));
assert.ok(report.rows.some((row) => row.dir === ".agents/skills/using-codebase-memory/references" && row.has_directory === true));
assert.ok(report.rows.some((row) => row.dir === "docs/superpowers/plans" && row.has_directory === true));
assert.ok(report.rows.some((row) => row.dir === "docs/superpowers/specs" && row.has_directory === true));
assert.deepEqual(report.rows.filter((row) => !row.has_directory), []);

const textResult = run(["--since=30 days ago", "--limit=5", "--min-churn=5"]);
assert.equal(textResult.status, 0, `text audit must succeed\nSTDOUT:\n${textResult.stdout}\nSTDERR:\n${textResult.stderr}`);
assert.match(textResult.stdout, /Directory documentation audit/);
assert.match(textResult.stdout, /missing: 0/);
assert.match(textResult.stdout, /_tests/);

const trackedDirectories = new Set();
for (const relPath of execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split(/\r?\n/).filter(Boolean)) {
  let directory = path.dirname(relPath);
  while (directory && directory !== ".") {
    trackedDirectories.add(directory);
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
}
const missingTrackedDirectoryMaps = [...trackedDirectories]
  .filter((directory) => !fs.existsSync(path.join(ROOT, directory, "DIRECTORY.md")))
  .sort();
assert.deepEqual(missingTrackedDirectoryMaps, [], `tracked directories missing DIRECTORY.md:\n${missingTrackedDirectoryMaps.join("\n")}`);

console.log("smoke_directory_docs_audit ok");
