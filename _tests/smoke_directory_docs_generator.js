"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "generate_directory_docs.js");
const SNAPSHOT_ROOT = path.join(ROOT, "_workflow", "control_plane", "snapshots");
const FILE_BACKUPS_ROOT = path.join(ROOT, "_workflow", "control_plane", "file_backups");
const PRUNE_BACKUPS_ROOT = path.join(ROOT, "_workflow", "control_plane", "oauth21_prune_backups");

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
assert.match(result.stdout, /wrote _workflow\\control_plane\\file_backups\\DIRECTORY\.md/);
assert.match(result.stdout, /wrote _workflow\\control_plane\\oauth21_prune_backups\\DIRECTORY\.md/);

const packageJson = read("package.json");
const scriptSource = read(path.join("scripts", "generate_directory_docs.js"));
const rootDirectory = read("DIRECTORY.md");
const workflowDirectory = read("_workflow/DIRECTORY.md");
const fileBackupsDirectory = read("_workflow/control_plane/file_backups/DIRECTORY.md");
const pruneBackupsDirectory = read("_workflow/control_plane/oauth21_prune_backups/DIRECTORY.md");
const todayMatch = scriptSource.match(/const TODAY = "([^"]+)";/);
assert.ok(todayMatch, "generator must declare TODAY constant");
const today = todayMatch[1];
assert.ok(packageJson.includes("\"docs:directory\": \"node scripts/generate_directory_docs.js\""));
assert.ok(rootDirectory.includes(`Updated: ${today}`));
assert.ok(workflowDirectory.includes("bounded OAuth21 prune records/backups"));
assert.ok(fileBackupsDirectory.includes("runtime-owned backup bundles"));
assert.ok(fileBackupsDirectory.includes("stage8_52d_control_plane_selftest/"));
assert.ok(pruneBackupsDirectory.includes("explicit OAuth21 prune execute runs"));
assert.ok(pruneBackupsDirectory.includes("live-prune-2026-07-15/"));

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

const runtimeOwnedRoots = [
  {
    root: FILE_BACKUPS_ROOT,
    relRoot: path.join("_workflow", "control_plane", "file_backups"),
    emptyOk: true,
  },
  {
    root: PRUNE_BACKUPS_ROOT,
    relRoot: path.join("_workflow", "control_plane", "oauth21_prune_backups"),
    emptyOk: false,
  },
];

for (const runtimeRoot of runtimeOwnedRoots) {
  const childDirs = fs
    .readdirSync(runtimeRoot.root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  assert.ok(childDirs.length > 0, `${runtimeRoot.relRoot} must keep at least one bundle directory for generator coverage`);

  for (const childName of childDirs) {
    const rel = path.join(runtimeRoot.relRoot, childName, "DIRECTORY.md");
    const content = read(rel);
    assert.ok(content.includes(`This bundle belongs to \`${childName}\``), `${childName} must be named in its generated DIRECTORY.md`);
    assert.ok(content.includes("runtime-owned support material"), `${childName} must keep runtime-owned support boundary`);
    if (runtimeRoot.emptyOk && childName === "stage8_52d_control_plane_selftest") {
      assert.ok(content.includes("It is currently empty."), `${childName} must document empty runtime-owned bundles`);
    }
    if (!runtimeRoot.emptyOk && childName === "live-prune-2026-07-15") {
      assert.ok(content.includes("SQLite backup artifact"), `${childName} must describe sqlite backup artifacts`);
      assert.ok(content.includes("JSON control-plane receipt"), `${childName} must describe json receipt artifacts`);
    }
  }
}

console.log("smoke_directory_docs_generator ok");
