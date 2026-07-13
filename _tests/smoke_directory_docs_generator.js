"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "generate_directory_docs.js");
const SNAPSHOT_ROOT = path.join(ROOT, "_workflow", "control_plane", "snapshots");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function runGenerator() {
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

const result = runGenerator();
assert.equal(result.status, 0, `directory docs generator must succeed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
assert.match(result.stdout, /wrote DIRECTORY\.md/);
assert.match(result.stdout, /wrote _workflow\\control_plane\\snapshots\\/);

const packageJson = read("package.json");
const rootDirectory = read("DIRECTORY.md");
const workflowDirectory = read("_workflow/DIRECTORY.md");
assert.ok(packageJson.includes("\"docs:directory\": \"node scripts/generate_directory_docs.js\""));
assert.ok(rootDirectory.includes("Updated: 2026-07-13"));
assert.ok(workflowDirectory.includes("bounded OAuth21 prune records/backups"));

const snapshotDirs = fs
  .readdirSync(SNAPSHOT_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

assert.ok(snapshotDirs.length > 0, "expected archived control-plane snapshots to exist");

for (const snapshotName of snapshotDirs) {
  const rel = path.join("_workflow", "control_plane", "snapshots", snapshotName, "DIRECTORY.md");
  const content = read(rel);
  assert.ok(content.includes("Status: archived snapshot directory map"), `${snapshotName} must be marked as archived snapshot`);
  assert.ok(content.includes(snapshotName), `${snapshotName} must be named in its generated DIRECTORY.md`);
  assert.ok(content.includes("archival evidence only"), `${snapshotName} must keep archival authority boundary`);
}

console.log("smoke_directory_docs_generator ok");
